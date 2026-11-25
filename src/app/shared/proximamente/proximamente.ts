import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-proximamente',
  standalone: true,
  template: `
    <section class="proximamente">
      <h1>{{ titulo }}</h1>
      <p>Próximamente</p>
    </section>
  `,
  styles: `
    .proximamente {
      padding: 3rem 1rem;
      text-align: center;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      color: var(--brand-ink);
    }
    p {
      margin: 0;
      color: var(--brand-muted);
    }
  `,
})
export class Proximamente {
  protected readonly titulo: string = inject(ActivatedRoute).snapshot.data['titulo'] ?? '';
}
