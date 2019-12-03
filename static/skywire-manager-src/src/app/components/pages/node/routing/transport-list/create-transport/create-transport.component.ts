import { Component, OnInit, ViewChild, OnDestroy, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Subscription, of } from 'rxjs';
import { delay, flatMap } from 'rxjs/operators';

import { TransportService } from '../../../../../../services/transport.service';
import { ButtonComponent } from '../../../../../layout/button/button.component';
import { NodeComponent } from '../../../node.component';
import { SnackbarService } from '../../../../../../services/snackbar.service';
import { AppConfig } from 'src/app/app.config';

/**
 * Modal window used for creating trnasports. It creates the transport and shows a
 * confirmation msg by itself.
 */
@Component({
  selector: 'app-create-transport',
  templateUrl: './create-transport.component.html',
  styleUrls: ['./create-transport.component.scss']
})
export class CreateTransportComponent implements OnInit, OnDestroy {
  @ViewChild('button', { static: false }) button: ButtonComponent;
  @ViewChild('firstInput', { static: false }) firstInput: ElementRef;
  types: string[];
  form: FormGroup;

  private shouldShowError = true;
  private dataSubscription: Subscription;
  private operationSubscription: Subscription;

  /**
   * Opens the modal window. Please use this function instead of opening the window "by hand".
   */
  public static openDialog(dialog: MatDialog): MatDialogRef<CreateTransportComponent, any> {
    const config = new MatDialogConfig();
    config.autoFocus = false;
    config.width = AppConfig.mediumModalWidth;

    return dialog.open(CreateTransportComponent, config);
  }

  constructor(
    private transportService: TransportService,
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<CreateTransportComponent>,
    private snackbarService: SnackbarService,
  ) { }

  ngOnInit() {
    this.form = this.formBuilder.group({
      'remoteKey': ['', Validators.compose([
        Validators.required,
        Validators.minLength(66),
        Validators.maxLength(66),
        Validators.pattern('^[0-9a-fA-F]+$')])
      ],
      'type': ['', Validators.required],
    });

    // Load the list of available types.
    this.loadData(0);
  }

  ngOnDestroy() {
    this.snackbarService.closeCurrentIfTemporaryError();
    this.dataSubscription.unsubscribe();
    if (this.operationSubscription) {
      this.operationSubscription.unsubscribe();
    }
  }

  /**
   * Creates the transport.
   */
  create() {
    if (!this.form.valid || this.button.disabled) {
      return;
    }

    this.button.showLoading();

    this.operationSubscription = this.transportService.create(
      // The node pk is obtained from the currently openned node page.
      NodeComponent.getCurrentNodeKey(),
      this.form.get('remoteKey').value,
      this.form.get('type').value,
    ).subscribe({
      next: this.onSuccess.bind(this),
      error: this.onError.bind(this)
    });
  }

  private onSuccess() {
    NodeComponent.refreshCurrentDisplayedData();
    this.snackbarService.showDone('transports.dialog.success');
    this.dialogRef.close();
  }

  private onError(error: string) {
    this.button.showError();
    this.snackbarService.showError('transports.dialog.error');
  }

  /**
   * Loads the list of available types.
   */
  private loadData(delayMilliseconds: number) {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }

    this.dataSubscription = of(1).pipe(
      // Wait the delay.
      delay(delayMilliseconds),
      // Load the data. The node pk is obtained from the currently openned node page.
      flatMap(() => this.transportService.types(NodeComponent.getCurrentNodeKey()))
    ).subscribe(
      types => {
        this.snackbarService.closeCurrentIfTemporaryError();
        setTimeout(() => (this.firstInput.nativeElement as HTMLElement).focus());
        this.types = types;
      },
      () => {
        // Show an error msg if it has not be done before during the current attempt to obtain the data.
        if (this.shouldShowError) {
          this.snackbarService.showError('common.loading-error', null, true);
          this.shouldShowError = false;
        }

        // Retry after a small delay.
        this.loadData(3000);
      },
    );
  }
}
