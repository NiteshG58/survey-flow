import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-survey-expire',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="expire-body">
      <div class="expire-card">
        <div class="expire-content">
          <div class="expire-text">
            <p>This file is expired. Please export again.</p>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .expire-body {
      padding: 0;
      display: block;
      width: 100%;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #55544d;
      font-family: 'Source Sans Pro', sans-serif;
    }
    .expire-card {
      background: #fff;
      width: 650px;
      max-width: 90%;
    }
    .expire-content {
      display: block;
      clear: both;
      padding: 20px;
      text-align: center;
    }
    .expire-text {
      font-size: 30px;
      color: #333;
    }
  `]
})
export class SurveyExpireComponent { }
