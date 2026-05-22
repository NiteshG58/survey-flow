import { Routes } from '@angular/router';
import { QuestionnaireComponent } from './components/questionnaire/questionnaire.component';
import { SurveyFinalComponent } from './components/survey-final/survey-final.component';
import { SurveyClosedComponent } from './components/survey-closed/survey-closed.component';
import { SurveyRedirectComponent } from './components/survey-redirect/survey-redirect.component';
import { SurveyExpireComponent } from './components/survey-expire/survey-expire.component';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';
import { ProcessFinishRedirectComponent } from './components/process-finish-redirect/process-finish-redirect.component';

export const routes: Routes = [
    { path: 'screenersurvey/final', component: SurveyFinalComponent },
    { path: 'screenersurvey/closed', component: SurveyClosedComponent },
    { path: 'screenersurvey/redirect', component: SurveyRedirectComponent },
    { path: 'screenersurvey/expiretime', component: SurveyExpireComponent },
    { path: 'processFinish', component: ProcessFinishRedirectComponent },
{ path: 'access_denied', component: AccessDeniedComponent },
    { path: 'screenersurvey/:questionKey', component: QuestionnaireComponent },
    { path: '', redirectTo: 'screenersurvey/start', pathMatch: 'full' },
    { path: 'landing', redirectTo: 'screenersurvey/closed' },
    { path: '**', redirectTo: 'access_denied' }
];
