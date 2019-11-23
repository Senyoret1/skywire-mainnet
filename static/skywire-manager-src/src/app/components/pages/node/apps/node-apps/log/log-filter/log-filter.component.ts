import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AppConfig } from 'src/app/app.config';

export interface LogsFilter {
  text: string;
  days: number;
}

@Component({
  selector: 'app-log-filter',
  templateUrl: './log-filter.component.html',
  styleUrls: ['./log-filter.component.scss']
})
export class LogFilterComponent implements OnInit, OnDestroy {
  filters: LogsFilter[];
  form: FormGroup;

  private formSubscription: Subscription;

  public static openDialog(dialog: MatDialog, data: LogsFilter): MatDialogRef<LogFilterComponent, any> {
    const config = new MatDialogConfig();
    config.data = data;
    config.autoFocus = false;
    config.width = AppConfig.smallModalWidth;

    return dialog.open(LogFilterComponent, config);
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) private data: LogsFilter,
    private dialogRef: MatDialogRef<LogFilterComponent>,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit() {
    this.filters = [
      {
        text: 'apps.log.filter.7-days',
        days: 7
      },
      {
        text: 'apps.log.filter.1-month',
        days: 30
      },
      {
        text: 'apps.log.filter.3-months',
        days: 90
      },
      {
        text: 'apps.log.filter.6-months',
        days: 180
      },
      {
        text: 'apps.log.filter.1-year',
        days: 365
      },
      {
        text: 'apps.log.filter.all',
        days: -1
      }
    ];


    this.form = this.formBuilder.group({
      'filter': [this.data.days],
    });

    this.formSubscription = this.form.get('filter').valueChanges.subscribe(days => {
      this.dialogRef.close(this.filters.find(filter => filter.days === days));
    });
  }

  ngOnDestroy() {
    this.formSubscription.unsubscribe();
  }
}