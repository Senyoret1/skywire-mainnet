import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/pages/login/login.component';
import { NodeListComponent } from './components/pages/node-list/node-list.component';
import { NodeComponent } from './components/pages/node/node.component';
import { AuthGuardService } from './services/auth-guard.service';
import { SettingsComponent } from './components/pages/settings/settings.component';
import { PasswordComponent } from './components/pages/settings/password/password.component';
import { RoutingComponent } from './components/pages/node/routing/routing.component';
import { AppsComponent } from './components/pages/node/apps/apps.component';
import { SidenavComponent } from './components/layout/sidenav/sidenav.component';
import { AllTransportsComponent } from './components/pages/node/routing/all-transports/all-transports.component';
import { AllRoutesComponent } from './components/pages/node/routing/all-routes/all-routes.component';
import { AllAppsComponent } from './components/pages/node/apps/node-apps/all-apps/all-apps.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'nodes',
    component: SidenavComponent,
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        component: NodeListComponent
      },
      {
        path: ':key',
        component: NodeComponent,
        children: [
          {
            path: '',
            redirectTo: 'routing',
            pathMatch: 'full'
          },
          {
            path: 'routing',
            component: RoutingComponent
          },
          {
            path: 'apps',
            component: AppsComponent
          },
          {
            path: 'transports',
            redirectTo: 'transports/1',
            pathMatch: 'full'
          },
          {
            path: 'transports/:page',
            component: AllTransportsComponent
          },
          {
            path: 'routes',
            redirectTo: 'routes/1',
            pathMatch: 'full'
          },
          {
            path: 'routes/:page',
            component: AllRoutesComponent
          },
          {
            path: 'apps-list',
            redirectTo: 'apps-list/1',
            pathMatch: 'full'
          },
          {
            path: 'apps-list/:page',
            component: AllAppsComponent
          },
        ]
      },
    ],
  },
  {
    path: 'settings',
    component: SidenavComponent,
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        component: SettingsComponent
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login'
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    useHash: true,
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {
}


