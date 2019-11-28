import { Component, EventEmitter, Input, Output, ViewChild, OnDestroy } from '@angular/core';
import { MatButton } from '@angular/material/button';

enum ButtonStates {
  Normal, Success, Error, Loading
}

/**
 * Common button used in the app.
 */
@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss']
})
export class ButtonComponent implements OnDestroy {
  @ViewChild('button1', { static: false }) button1: MatButton;
  @ViewChild('button2', { static: false }) button2: MatButton;

  // Should be be 'mat-button' or 'mat-raised-button'.
  @Input() type = 'mat-button';
  @Input() disabled = false;
  @Input() icon: string;
  // Must be one of the colors defined on the default theme.
  @Input() color = '';
  @Input() loadingSize = 24;
  // Click event.
  @Output() action = new EventEmitter();
  notification = false;
  state = ButtonStates.Normal;
  buttonStates = ButtonStates;

  private readonly successDuration = 3000;

  ngOnDestroy() {
    this.action.complete();
  }

  click() {
    if (!this.disabled) {
      this.reset();
      this.action.emit();
    }
  }

  reset() {
    this.state = ButtonStates.Normal;
    this.disabled = false;
    this.notification = false;
  }

  focus() {
    if (this.button1) {
      this.button1.focus();
    }
    if (this.button2) {
      this.button2.focus();
    }
  }

  showEnabled() {
    this.disabled = false;
  }

  showDisabled() {
    this.disabled = true;
  }

  showLoading() {
    this.state = ButtonStates.Loading;
    this.disabled = true;
  }

  showSuccess() {
    this.state = ButtonStates.Success;
    this.disabled = false;

    setTimeout(() => this.state = ButtonStates.Normal, this.successDuration);
  }

  showError() {
    this.state = ButtonStates.Error;
    this.disabled = false;
  }

  notify(notification: boolean) {
    this.notification = notification;
  }
}
