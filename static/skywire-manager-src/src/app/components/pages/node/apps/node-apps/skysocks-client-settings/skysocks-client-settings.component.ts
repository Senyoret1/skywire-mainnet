import { Component, OnInit, ViewChild, OnDestroy, ElementRef, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialog, MatDialogConfig, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { ButtonComponent } from '../../../../../layout/button/button.component';
import { NodeComponent } from '../../../node.component';
import { SnackbarService } from '../../../../../../services/snackbar.service';
import { AppConfig } from 'src/app/app.config';
import { processServiceError } from 'src/app/utils/errors';
import { OperationError } from 'src/app/utils/operation-error';
import { AppsService } from 'src/app/services/apps.service';
import GeneralUtils from 'src/app/utils/generalUtils';
import { Application, ProxyDiscoveryEntry } from 'src/app/app.datatypes';
import { ProxyDiscoveryService } from 'src/app/services/proxy-discovery.service';
import { EditSkysocksClientNoteComponent } from './edit-skysocks-client-note/edit-skysocks-client-note.component';
import { SelectableOption, SelectOptionComponent } from 'src/app/components/layout/select-option/select-option.component';
import {
  SkysocksClientFilterComponent,
  SkysocksClientFilters,
  StateFilterStates
} from './skysocks-client-filter/skysocks-client-filter.component';

/**
 * Data of the entries from the history.
 */
export interface HistoryEntry {
  /**
   * Remote public key.
   */
  key: string;
  /**
   * If true, the user entered the data manually using the form. If false, the data was obtained
   * from the discovery service.
   */
  enteredManually: boolean;
  /**
   * Location of the visor. Only if it was obtained from the discovery service.
   */
  location?: string;
  /**
   * Custom note added by the user.
   */
  note?: string;
}

/**
 * Modal window used for configuring the Skysocks-client app.
 */
@Component({
  selector: 'app-skysocks-client-settings',
  templateUrl: './skysocks-client-settings.component.html',
  styleUrls: ['./skysocks-client-settings.component.scss']
})
export class SkysocksClientSettingsComponent implements OnInit, OnDestroy {
  // Key for saving the history in persistent storage.
  private readonly historyStorageKey = 'SkysocksClientHistory_';
  // Max elements the history can contain.
  readonly maxHistoryElements = 10;

  @ViewChild('button', { static: false }) button: ButtonComponent;
  @ViewChild('firstInput', { static: false }) firstInput: ElementRef;
  form: FormGroup;
  // Entries to show on the history.
  history: HistoryEntry[];

  // Proxies obtained from the discovery service.
  proxiesFromDiscovery: ProxyDiscoveryEntry[];
  // Filtered proxies.
  proxiesFromDiscoveryToShow: ProxyDiscoveryEntry[];
  // If the system is still getting the proxies from the discovery service.
  loadingFromDiscovery = true;

  // Current filters for the poxies from the discovery service.
  currentFilters = new SkysocksClientFilters();
  // Texts to be shown on the filter button. Each element represents a filter and has 3
  // elements. The fist one is a translatable var which describes the filter, the second one has
  // the value selected by the user if it is a variable for the translate pipe and the third one
  // has the value selected by the user if the translate pipe is not needed,
  currentFiltersTexts: string[][] = [];

  stateFilterStates = StateFilterStates;

  // If the operation in currently being made.
  private working = false;
  private operationSubscription: Subscription;
  private discoverySubscription: Subscription;

  /**
   * Opens the modal window. Please use this function instead of opening the window "by hand".
   */
  public static openDialog(dialog: MatDialog, app: Application): MatDialogRef<SkysocksClientSettingsComponent, any> {
    const config = new MatDialogConfig();
    config.data = app;
    config.autoFocus = false;
    config.width = AppConfig.largeModalWidth;

    return dialog.open(SkysocksClientSettingsComponent, config);
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) private data: Application,
    private dialogRef: MatDialogRef<SkysocksClientSettingsComponent>,
    private appsService: AppsService,
    private formBuilder: FormBuilder,
    private snackbarService: SnackbarService,
    private dialog: MatDialog,
    private proxyDiscoveryService: ProxyDiscoveryService,
  ) { }

  ngOnInit() {
    // Get the proxies from the discovery service.
    this.discoverySubscription = this.proxyDiscoveryService.getProxies().subscribe(response => {
      this.proxiesFromDiscovery = response;
      this.filterProxies();
      this.loadingFromDiscovery = false;
    });

    // Get the history.
    const retrievedHistory = localStorage.getItem(this.historyStorageKey);
    if (retrievedHistory) {
      this.history = JSON.parse(retrievedHistory);
    } else {
      this.history = [];
    }

    // Get the current value saved on the visor, if it was returned by the API.
    let currentVal = '';
    if (this.data.args && this.data.args.length > 0) {
      for (let i = 0; i < this.data.args.length; i++) {
        if (this.data.args[i] === '-srv' && i + 1 < this.data.args.length) {
          currentVal = this.data.args[i + 1];
        }
      }
    }

    this.form = this.formBuilder.group({
      'pk': [currentVal, Validators.compose([
        Validators.required,
        Validators.minLength(66),
        Validators.maxLength(66),
        Validators.pattern('^[0-9a-fA-F]+$')])
      ],
    });

    setTimeout(() => (this.firstInput.nativeElement as HTMLElement).focus());
  }

  ngOnDestroy() {
    this.discoverySubscription.unsubscribe();
    if (this.operationSubscription) {
      this.operationSubscription.unsubscribe();
    }
  }

  // Opens the modal window for selecting the filters.
  changeFilters() {
    SkysocksClientFilterComponent.openDialog(this.dialog, this.currentFilters).afterClosed().subscribe(response => {
      if (response) {
        this.currentFilters = response;
        this.filterProxies();
      }
    });
  }

  // Filters the proxies obtained from the discovery service using the filters selected by
  // the user.
  private filterProxies() {
    if (this.currentFilters.state.state === StateFilterStates.NoFilter && !this.currentFilters.location && !this.currentFilters.key) {
      this.proxiesFromDiscoveryToShow = this.proxiesFromDiscovery;
    } else {
      this.proxiesFromDiscoveryToShow = this.proxiesFromDiscovery.filter(proxy => {
        if (this.currentFilters.state.state === StateFilterStates.Available && !proxy.available) {
          return false;
        }
        if (this.currentFilters.state.state === StateFilterStates.Offline && proxy.available) {
          return false;
        }
        if (this.currentFilters.location && !proxy.location.toLowerCase().includes(this.currentFilters.location.toLowerCase())) {
          return false;
        }
        if (this.currentFilters.key && !proxy.publicKeyPort.toLowerCase().includes(this.currentFilters.key.toLowerCase())) {
          return false;
        }

        return true;
      });
    }

    this.updateCurrentFilters();
  }

  // Updates the texts of the filter button.
  private updateCurrentFilters() {
    this.currentFiltersTexts = [];

    if (this.currentFilters.state.state !== StateFilterStates.NoFilter) {
      this.currentFiltersTexts.push(['apps.skysocks-client-settings.filter-dialog.state', this.currentFilters.state.text, '']);
    }
    if (this.currentFilters.location) {
      this.currentFiltersTexts.push(['apps.skysocks-client-settings.filter-dialog.location', '', this.currentFilters.location]);
    }
    if (this.currentFilters.key) {
      this.currentFiltersTexts.push(['apps.skysocks-client-settings.filter-dialog.pub-key', '', this.currentFilters.key]);
    }
  }

  // Opens the modal window used on small screens with the options of an history entry.
  openHistoryOptions(historyEntry: HistoryEntry) {
    const options: SelectableOption[] = [
      {
        icon: 'chevron_right',
        label: 'apps.skysocks-client-settings.use',
      },
      {
        icon: 'edit',
        label: 'apps.skysocks-client-settings.change-note',
      },
      {
        icon: 'close',
        label: 'apps.skysocks-client-settings.remove-entry',
      }
    ];

    SelectOptionComponent.openDialog(this.dialog, options).afterClosed().subscribe((selectedOption: number) => {
      if (selectedOption === 1) {
        this.saveChanges(historyEntry.key, historyEntry.enteredManually, historyEntry.location, historyEntry.note);
      } else if (selectedOption === 2) {
        this.changeNote(historyEntry);
      } else if (selectedOption === 3) {
        this.removeFromHistory(historyEntry.key);
      }
    });
  }

  // Removes an element from the history.
  removeFromHistory(key: String) {
    // Ask for confirmation.
    const confirmationMsg = 'apps.skysocks-client-settings.remove-from-history-confirmation';
    const confirmationDialog = GeneralUtils.createConfirmationDialog(this.dialog, confirmationMsg);

    confirmationDialog.componentInstance.operationAccepted.subscribe(() => {
      this.history = this.history.filter(value => value.key !== key);
      const dataToSave = JSON.stringify(this.history);
      localStorage.setItem(this.historyStorageKey, dataToSave);

      confirmationDialog.close();
    });
  }

  // Opens the modal window for changing the personal note of an history entry.
  changeNote(entry: HistoryEntry) {
    EditSkysocksClientNoteComponent.openDialog(this.dialog, entry.note).afterClosed().subscribe((response: string) => {
      if (response) {
        // Remove the "-" char the modal window adds at the start of the note.
        response = response.substr(1, response.length - 1);

        // Change the note.
        this.history.forEach(value => {
          if (value.key === entry.key) {
            value.note = response;
          }
        });

        // Save the changes..
        const dataToSave = JSON.stringify(this.history);
        localStorage.setItem(this.historyStorageKey, dataToSave);

        if (!response) {
          this.snackbarService.showWarning('apps.skysocks-client-settings.default-note-warning');
        } else {
          this.snackbarService.showDone('apps.skysocks-client-settings.changes-made');
        }
      }
    });
  }

  /**
   * Saves the settings. If no argument is provided, the function will take the public key
   * from the form and fill the rest of the data. The arguments are mainly for proxies selected
   * from the discovery list and entries from the history.
   * @param publicKey New public key to be used.
   * @param enteredManually If the user manually entered the data using the form.
   * @param location Location of the proxy server.
   * @param note Personal note for the history.
   */
  saveChanges(publicKey: string = null, enteredManually: boolean = null, location: string = null, note: string = null) {
    // If no public key was provided, the data will be retrieved from the form, so the form
    // must be valid. Also, the operation can not continue if the component is already working.
    if ((!this.form.valid && !publicKey) || this.working) {
      return;
    }

    enteredManually = publicKey ? enteredManually : true;
    publicKey = publicKey ? publicKey : this.form.get('pk').value;

    // Ask for confirmation.
    const confirmationMsg = 'apps.skysocks-client-settings.change-key-confirmation';
    const confirmationDialog = GeneralUtils.createConfirmationDialog(this.dialog, confirmationMsg);
    confirmationDialog.componentInstance.operationAccepted.subscribe(() => {
      confirmationDialog.close();
      this.continueSavingChanges(publicKey, enteredManually, location, note);
    });
  }

  // Makes the call to the hypervisor API for changing the configuration.
  private continueSavingChanges(publicKey: string, enteredManually: boolean, location: string, note: string) {
    this.button.showLoading();
    this.working = true;

    this.operationSubscription = this.appsService.changeAppSettings(
      // The node pk is obtained from the currently openned node page.
      NodeComponent.getCurrentNodeKey(),
      this.data.name,
      { pk: publicKey },
    ).subscribe(
      () => this.onSuccess(publicKey, enteredManually, location, note),
      err => this.onError(err),
    );
  }

  private onSuccess(publicKey: string, enteredManually: boolean, location: string, note: string) {
    // Remove any repeated entry from the history.
    this.history = this.history.filter(value => value.key !== publicKey);

    // Add the available data to the history entry.
    const newEntry: HistoryEntry = {
      key: publicKey,
      enteredManually: enteredManually,
    };
    if (location) {
      newEntry.location = location;
    }
    if (note) {
      newEntry.note = note;
    }

    // Save the data on the history.
    this.history = [newEntry].concat(this.history);
    if (this.history.length > this.maxHistoryElements) {
      const itemsToRemove = this.history.length - this.maxHistoryElements;
      this.history.splice(this.history.length - itemsToRemove, itemsToRemove);
    }

    const dataToSave = JSON.stringify(this.history);
    localStorage.setItem(this.historyStorageKey, dataToSave);

    // Close the window.
    NodeComponent.refreshCurrentDisplayedData();
    this.snackbarService.showDone('apps.skysocks-client-settings.changes-made');
    this.dialogRef.close();
  }

  private onError(err: OperationError) {
    this.working = false;
    this.button.showError();
    err = processServiceError(err);

    this.snackbarService.showError(err);
  }
}
