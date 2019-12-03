import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { StorageService } from './services/storage.service';
import { SnackbarService } from './services/snackbar.service';
import { LanguageService } from './services/language.service';

/**
 * Root app component.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    // Imported to call its constructor right after opening the app.
    storage: StorageService,
    location: Location,
    router: Router,
    snackbarService: SnackbarService,
    dialog: MatDialog,
    languageService: LanguageService,
  ) {
    // Close the snackbar when opening a modal window.
    dialog.afterOpened.subscribe(() => snackbarService.closeCurrent());

    // Scroll to the top after navigating.
    // When navigating, scroll to the top and close the snackbar and all modal windows.
    router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        snackbarService.closeCurrent();
        dialog.closeAll();
        window.scrollTo(0, 0);
      }
    });

    // Initialize the language configuration.
    languageService.loadLanguageSettings();
  }
}
