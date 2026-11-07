import React from 'react';
import { createRoot } from 'react-dom/client';
import DepthCarousel from './DepthCarousel.jsx';

const items = [
  { image: 'https://picsum.photos/seed/nurse1/800/1000', alt: 'Formação clínica' },
  { image: 'https://picsum.photos/seed/nurse2/800/1000', alt: 'Cuidados intensivos' },
  { image: 'https://picsum.photos/seed/nurse3/800/1000', alt: 'Bloco operatório' },
  { image: 'https://picsum.photos/seed/nurse4/800/1000', alt: 'Emergências' },
  { image: 'https://picsum.photos/seed/nurse5/800/1000', alt: 'Formação prática' }
];

const mount = document.getElementById('depth-carousel-root');

if (mount) {
  createRoot(mount).render(
    <DepthCarousel
      items={items}
      depth={220}
      spread={90}
      tilt={22}
      tiltDirection="right"
      perspective={1400}
      visibleCards={4}
      falloff={0.2}
      blur={6}
      autoplay={false}
      loop
      cardWidth={300}
      cardHeight={380}
      radius={18}
      tint="#05060a"
      duration={700}
      ease="power3.out"
      autoplayDelay={3200}
      showControls
      showIndicators
    />
  );
}
