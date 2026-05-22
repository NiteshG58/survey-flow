import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-survey-final',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './survey-final.component.html',
  styles: []
})
export class SurveyFinalComponent {
  constructor(private router: Router, private route: ActivatedRoute) { }

  startSurvey(): void {
    // Navigate to the first question (e.g., 'start')
    // This replicates the flow where 'final' is actually a landing page in the legacy app
    this.router.navigate(['screenersurvey', 'start'], {
      queryParamsHandling: 'preserve'
    });
  }
}
