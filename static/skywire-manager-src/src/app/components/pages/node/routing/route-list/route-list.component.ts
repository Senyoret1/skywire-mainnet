import { Component, Input, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

import { Route } from 'src/app/app.datatypes';
import { RouteService } from '../../../../../services/route.service';
import { NodeComponent } from '../../node.component';
import { RouteDetailsComponent } from './route-details/route-details.component';
import { AppConfig } from '../../../../../app.config';
import GeneralUtils from '../../../../../utils/generalUtils';
import { ConfirmationComponent } from '../../../../layout/confirmation/confirmation.component';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SelectOptionComponent, SelectableOption } from 'src/app/components/layout/select-option/select-option.component';
import { SelectColumnComponent, SelectedColumn } from 'src/app/components/layout/select-column/select-column.component';

/**
 * List of the columns that can be used to sort the data.
 */
enum SortableColumns {
  Key = 'routes.key',
  Rule = 'routes.rule',
}

/**
 * Shows the list of routes of a node. I can be used to show a short preview, with just some
 * elements and a link for showing the rest: or the full list, with pagination controls.
 */
@Component({
  selector: 'app-route-list',
  templateUrl: './route-list.component.html',
  styleUrls: ['./route-list.component.scss']
})
export class RouteListComponent implements OnDestroy {
  private static sortByInternal = SortableColumns.Key;
  private static sortReverseInternal = false;

  @Input() nodePK: string;

  // Vars for keeping track of the column used for sorting the data.
  sortableColumns = SortableColumns;
  get sortBy(): SortableColumns { return RouteListComponent.sortByInternal; }
  set sortBy(val: SortableColumns) { RouteListComponent.sortByInternal = val; }
  get sortReverse(): boolean { return RouteListComponent.sortReverseInternal; }
  set sortReverse(val: boolean) { RouteListComponent.sortReverseInternal = val; }
  get sortingArrow(): string {
    return this.sortReverse ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  dataSource: Route[];
  /**
   * Keeps track of the state of the check boxes of the elements.
   */
  selections = new Map<number, boolean>();

  /**
   * If true, the control can only show few elements and, if there are more elements, a link for
   * accessing the full list. If false, the full list is shown, with pagination
   * controls, if needed.
   */
  showShortList_: boolean;
  @Input() set showShortList(val: boolean) {
    this.showShortList_ = val;
    this.recalculateElementsToShow();
  }

  allRoutes: Route[];
  routesToShow: Route[];
  numberOfPages = 1;
  currentPage = 1;
  // Used as a helper var, as the URL is read asynchronously.
  currentPageInUrl = 1;
  @Input() set routes(val: Route[]) {
    this.allRoutes = val;
    this.recalculateElementsToShow();
  }

  private navigationsSubscription: Subscription;
  private operationSubscriptionsGroup: Subscription[] = [];

  constructor(
    private routeService: RouteService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private snackbarService: SnackbarService,
  ) {
    this.navigationsSubscription = this.route.paramMap.subscribe(params => {
      if (params.has('page')) {
        let selectedPage = Number.parseInt(params.get('page'), 10);
        if (isNaN(selectedPage) || selectedPage < 1) {
          selectedPage = 1;
        }

        this.currentPageInUrl = selectedPage;

        this.recalculateElementsToShow();
      }
    });
  }

  ngOnDestroy() {
    this.navigationsSubscription.unsubscribe();
    this.operationSubscriptionsGroup.forEach(sub => sub.unsubscribe());
  }

  /**
   * Changes the selection state of an entry (modifies the state of its checkbox).
   */
  changeSelection(route: Route) {
    if (this.selections.get(route.key)) {
      this.selections.set(route.key, false);
    } else {
      this.selections.set(route.key, true);
    }
  }

  /**
   * Check if at lest one entry has been selected via its checkbox.
   */
  hasSelectedElements(): boolean {
    if (!this.selections) {
      return false;
    }

    let found = false;
    this.selections.forEach((val) => {
      if (val) {
        found = true;
      }
    });

    return found;
  }

  /**
   * Selects or deselects all items.
   */
  changeAllSelections(setSelected: boolean) {
    this.selections.forEach((val, key) => {
      this.selections.set(key, setSelected);
    });
  }

  /**
   * Deletes the selected elements.
   */
  deleteSelected() {
    // Ask for confirmation.
    const confirmationDialog = GeneralUtils.createConfirmationDialog(this.dialog, 'routes.delete-selected-confirmation');

    confirmationDialog.componentInstance.operationAccepted.subscribe(() => {
      confirmationDialog.componentInstance.showProcessing();

      const elementsToRemove: number[] = [];
      this.selections.forEach((val, key) => {
        if (val) {
          elementsToRemove.push(key);
        }
      });

      this.deleteRecursively(elementsToRemove, confirmationDialog);
    });
  }

  /**
   * Opens the modal window used on small screens with the options of an element.
   */
  showOptionsDialog(route: Route) {
    const options: SelectableOption[] = [
      {
        icon: 'visibility',
        label: 'routes.details.title',
      },
      {
        icon: 'close',
        label: 'routes.delete',
      }
    ];

    SelectOptionComponent.openDialog(this.dialog, options).afterClosed().subscribe((selectedOption: number) => {
      if (selectedOption === 1) {
        this.details(route.key.toString());
      } else if (selectedOption === 2) {
        this.delete(route.key);
      }
    });
  }

  /**
   * Shows a modal window with the details of a route.
   */
  details(route: string) {
    RouteDetailsComponent.openDialog(this.dialog, route);
  }

  /**
   * Deletes a specific element.
   */
  delete(routeKey: number) {
    const confirmationDialog = GeneralUtils.createConfirmationDialog(this.dialog, 'routes.delete-confirmation');

    confirmationDialog.componentInstance.operationAccepted.subscribe(() => {
      confirmationDialog.componentInstance.showProcessing();

      // Start the operation and save it for posible cancellation.
      this.operationSubscriptionsGroup.push(this.startDeleting(routeKey).subscribe(() => {
        confirmationDialog.close();
        // Make the parent page reload the data.
        NodeComponent.refreshCurrentDisplayedData();
        this.snackbarService.showDone('routes.deleted');
      }, () => {
        confirmationDialog.componentInstance.showDone('confirmation.error-header-text', 'routes.error-deleting');
      }));
    });
  }

  /**
   * Changes the column and/or order used for sorting the data.
   */
  changeSortingOrder(column: SortableColumns) {
    if (this.sortBy !== column) {
      this.sortBy = column;
      this.sortReverse = false;
    } else {
      this.sortReverse = !this.sortReverse;
    }

    this.recalculateElementsToShow();
  }

  /**
   * Opens the modal window used on small screens for selecting how to sort the data.
   */
  openSortingOrderModal() {
    // Get the list of sortable columns.
    const enumKeys = Object.keys(SortableColumns);
    const columnsMap = new Map<string, SortableColumns>();
    const columns = enumKeys.map(key => {
      const val = SortableColumns[key as any];
      columnsMap.set(val, SortableColumns[key]);

      return val;
    });

    SelectColumnComponent.openDialog(this.dialog, columns).afterClosed().subscribe((result: SelectedColumn) => {
      if (result) {
        if (columnsMap.has(result.label) && (result.sortReverse !== this.sortReverse || columnsMap.get(result.label) !== this.sortBy)) {
          this.sortBy = columnsMap.get(result.label);
          this.sortReverse = result.sortReverse;

          this.recalculateElementsToShow();
        }
      }
    });
  }

  /**
   * Sorts the data and recalculates which elements should be shown on the UI.
   */
  private recalculateElementsToShow() {
    // Needed to prevent racing conditions.
    this.currentPage = this.currentPageInUrl;

    // Needed to prevent racing conditions.
    if (this.allRoutes) {
      // Sort all the data.
      this.allRoutes.sort((a, b) => {
        const defaultOrder = a.key - b.key;

        let response: number;
        if (this.sortBy === SortableColumns.Key) {
          response = !this.sortReverse ? a.key - b.key : b.key - a.key;
        } else if (this.sortBy === SortableColumns.Rule) {
          response = !this.sortReverse ? a.rule.localeCompare(b.rule) : b.rule.localeCompare(a.rule);
        } else {
          response = defaultOrder;
        }

        return response !== 0 ? response : defaultOrder;
      });

      // Calculate the pagination values.
      const maxElements = this.showShortList_ ? AppConfig.maxShortListElements : AppConfig.maxFullListElements;
      this.numberOfPages = Math.ceil(this.allRoutes.length / maxElements);
      if (this.currentPage > this.numberOfPages) {
        this.currentPage = this.numberOfPages;
      }

      // Limit the elements to show.
      const start = maxElements * (this.currentPage - 1);
      const end = start + maxElements;
      this.routesToShow = this.allRoutes.slice(start, end);

      // Create a map with the elements to show, as a helper.
      const currentElementsMap = new Map<number, boolean>();
      this.routesToShow.forEach(route => {
        currentElementsMap.set(route.key, true);

        // Add to the selections map the elements that are going to be shown.
        if (!this.selections.has(route.key)) {
          this.selections.set(route.key, false);
        }
      });

      // Remove from the selections map the elements that are not going to be shown.
      const keysToRemove: number[] = [];
      this.selections.forEach((value, key) => {
        if (!currentElementsMap.has(key)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => {
        this.selections.delete(key);
      });
    } else {
      this.routesToShow = null;
      this.selections = new Map<number, boolean>();
    }

    this.dataSource = this.routesToShow;
  }

  /**
   * Prepares the operation for deteling an element, but does not start it. To start the operation,
   * subscribe to the response.
   */
  private startDeleting(routeKey: number): Observable<any> {
    return this.routeService.delete(NodeComponent.getCurrentNodeKey(), routeKey.toString());
  }

  /**
   * Recursively deletes a list of elements.
   * @param ids List with the IDs of the elements to delete.
   * @param confirmationDialog Dialog used for requesting confirmation from the user.
   */
  deleteRecursively(ids: number[], confirmationDialog: MatDialogRef<ConfirmationComponent, any>) {
    this.operationSubscriptionsGroup.push(this.startDeleting(ids[ids.length - 1]).subscribe(() => {
      ids.pop();
      if (ids.length === 0) {
        confirmationDialog.close();
        // Make the parent page reload the data.
        NodeComponent.refreshCurrentDisplayedData();
        this.snackbarService.showDone('routes.deleted');
      } else {
        this.deleteRecursively(ids, confirmationDialog);
      }
    }, () => {
      NodeComponent.refreshCurrentDisplayedData();
      confirmationDialog.componentInstance.showDone('confirmation.error-header-text', 'routes.error-deleting');
    }));
  }
}
