import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { SelectPageComponent } from './select-page/select-page.component';

/**
 * Generic paginator for the long lists of the app.
 */
@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.component.html',
  styleUrls: ['./paginator.component.scss']
})
export class PaginatorComponent {
  @Input() currentPage: number;
  @Input() numberOfPages: number;

  /**
   * Array with the parts of the route that must be openned by the buttons of the paginator.
   * This array must the same that would be usend in the "routerLink" property of an <a> tag.
   * The paginator will automatically add the number of the page at the end of the array, so,
   * for example, is "linkParts" is ['page1', 'page 2'] and the user selects the page number 5,
   * the <a> tag will open the URL corresponding to the array ['page1', 'page 2', '5'].
   */
  @Input() linkParts = [''];

  constructor(
    private dialog: MatDialog,
    private router: Router,
  ) { }

  openSelectionDialog() {
    SelectPageComponent.openDialog(this.dialog, this.numberOfPages).afterClosed().subscribe((selectedPage: number) => {
      if (selectedPage) {
        this.router.navigate(this.linkParts.concat([selectedPage.toString()]));
      }
    });
  }
}
