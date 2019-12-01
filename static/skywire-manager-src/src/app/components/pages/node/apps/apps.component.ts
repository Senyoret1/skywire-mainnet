import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { Application, Node } from '../../../../app.datatypes';
import { NodeComponent } from '../node.component';

/**
 * Page that shows the apps summary. It is a subpage of the Node page.
 */
@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit, OnDestroy {
  apps: Application[];
  nodePK: string;

  private dataSubscription: Subscription;

  ngOnInit() {
    // Get the node data from the parent page.
    this.dataSubscription = NodeComponent.currentNode.subscribe((node: Node) => {
      this.nodePK = node.local_pk;
      this.apps = node.apps;
    });
  }

  ngOnDestroy() {
    this.dataSubscription.unsubscribe();
  }
}
