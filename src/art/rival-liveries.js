  /* ---------- the 14 rival crews: liveries (designs x palettes) ----------
     Eight original designs, each drawn by a small function on the same atlas as the player's liveries (art/car-livery.js
     calls RIVAL_DESIGNS[name](H) with its drawing helpers). A design is reused by two crews at most, always with a very
     different palette and the other body, so the field never looks like clones. Colours: base = body, a / b = accents,
     c = dark trim. Sponsors are all invented. None of these may look like a real rally or racing livery.
     Used by art/rival-model.js. Data only plus painters: nothing here touches the scene. */
  const RIVAL_DESIGNS = {
    chevrons(H) {            // rows of forward-pointing arrowheads along the flank, arrow roof stripe
      const { sides, tops, poly, rect, word, C, spons } = H;
      sides((t) => {
        for (let k = 0; k < 8; k++) {
          const z = 2.05 - k * 0.52;
          poly(t, [[z - 0.3, 0.27], [z - 0.12, 0.27], [z + 0.2, -0.02], [z - 0.12, -0.3], [z - 0.3, -0.3], [z, -0.02]], k % 2 ? C.b : C.a);
        }
        rect(t, -2.3, -0.3, 2.3, -0.25, C.c);
        word(t, spons[0], 1.75, 0.2, 0.065, C.c, { spacing: 0.012 });
      });
      tops((t) => {
        for (let k = 0; k < 5; k++) { const z = 2.1 - k * 0.3; poly(t, [[z, 0], [z - 0.3, 0.6], [z - 0.45, 0.6], [z - 0.15, 0], [z - 0.45, -0.6], [z - 0.3, -0.6]], k % 2 ? C.b : C.a); }
        rect(t, 0.4, 0.62, -1.0, -0.62, C.c); rect(t, 0.4, 0.07, -1.0, -0.07, C.a); rect(t, -1.4, 0.7, -2.2, -0.7, C.a);
      });
    },
    bullseye(H) {            // a big target on every door and on the roof, number in the middle
      const { sides, tops, circ, rect, poly, word, C, spons } = H;
      sides((t) => {
        rect(t, -2.3, -0.3, 2.3, -0.22, C.c);
        for (const [z, r] of [[1.55, 0.3], [-1.35, 0.26]]) { circ(t, z, 0.02, r, C.a); circ(t, z, 0.02, r * 0.68, C.base); circ(t, z, 0.02, r * 0.38, C.b); }
        circ(t, 0.0, 0.02, 0.64, C.a); circ(t, 0.0, 0.02, 0.5, C.base); circ(t, 0.0, 0.02, 0.38, C.b);
        poly(t, [[2.3, 0.1], [2.3, -0.02], [1.9, -0.02]], C.b);
        word(t, spons[1], 0.0, -0.26, 0.05, C.base, { spacing: 0.03 });
        word(t, spons[0], -1.95, 0.2, 0.055, C.c, { spacing: 0.01 });
      });
      tops((t) => {
        circ(t, -0.3, 0, 0.62, C.a); circ(t, -0.3, 0, 0.46, C.base); circ(t, -0.3, 0, 0.3, C.b); circ(t, -0.3, 0, 0.14, C.c);
        rect(t, 2.2, 0.2, 1.0, 0.1, C.a); rect(t, 2.2, -0.1, 1.0, -0.2, C.a);
        rect(t, -1.5, 0.7, -2.2, -0.7, C.c);
      });
    },
    slash(H) {               // one fat diagonal band kicking up toward the tail, thin shadow line, split colour roof
      const { sides, tops, poly, rect, line, word, C, spons } = H;
      sides((t) => {
        poly(t, [[2.3, -0.3], [2.3, -0.1], [-2.3, 0.34], [-2.3, 0.06], [-0.4, -0.3]], C.a);
        poly(t, [[2.3, -0.1], [2.3, 0.0], [-2.3, 0.4], [-2.3, 0.34]], C.b);
        line(t, [[2.3, 0.1], [-2.3, 0.5]], C.c, 0.02);
        rect(t, -2.3, -0.3, 2.3, -0.25, C.c);
        word(t, spons[0], 1.2, -0.15, 0.085, C.base, { spacing: 0.015 });
        word(t, spons[1], -1.55, 0.14, 0.065, C.base, { spacing: 0.01 });
      });
      tops((t) => {
        poly(t, [[2.2, 0.8], [2.2, 0.15], [0.8, -0.8], [0.8, -0.2]], C.a); poly(t, [[2.2, -0.8], [2.2, -0.2], [1.5, -0.8]], C.b);
        rect(t, 0.4, 0.62, -1.0, 0.0, C.a); rect(t, 0.4, 0.0, -1.0, -0.62, C.c); rect(t, -1.4, 0.7, -2.2, -0.7, C.b);
      });
    },
    waves(H) {               // three rolling sine-wave ribbons running the length of the car
      const { sides, tops, rect, line, word, C, spons } = H;
      const wave = (z0, z1, y, amp, ph, n) => { const o = []; for (let k = 0; k <= n; k++) { const z = z0 + (z1 - z0) * k / n; o.push([z, y + amp * Math.sin(z * 3.3 + ph)]); } return o; };
      sides((t) => {
        rect(t, -2.3, -0.3, 2.3, -0.2, C.c);
        line(t, wave(2.3, -2.3, 0.1, 0.09, 0.0, 40), C.a, 0.1);
        line(t, wave(2.3, -2.3, 0.0, 0.09, 0.9, 40), C.b, 0.05);
        line(t, wave(2.3, -2.3, -0.1, 0.09, 1.8, 40), C.a, 0.035);
        word(t, spons[0], 1.45, 0.22, 0.05, C.c, { spacing: 0.02 });
      });
      tops((t) => {
        for (let k = 0; k < 3; k++) { const o = []; for (let j = 0; j <= 24; j++) { const z = 2.2 - j * 0.15; o.push([z, (k - 1) * 0.28 + 0.1 * Math.sin(z * 3.3 + k)]); } line(t, o, k === 1 ? C.b : C.a, 0.09); }
        rect(t, 0.4, 0.62, -1.0, -0.62, C.c); rect(t, -1.4, 0.7, -2.2, -0.7, C.c);
      });
    },
    checkband(H) {           // checkerboard strip down low, solid colour block on the sill, hood split in two halves
      const { sides, tops, rect, poly, word, C, spons } = H;
      sides((t) => {
        rect(t, -2.3, -0.3, 2.3, -0.17, C.c);
        for (let k = 0; k < 46; k++) { const z = 2.3 - k * 0.1; for (let r = 0; r < 2; r++) if ((k + r) % 2 === 0) rect(t, z, -0.17 + r * 0.065, z - 0.1, -0.105 + r * 0.065, C.b); }
        rect(t, -2.3, 0.0, 2.3, 0.04, C.a);
        poly(t, [[2.3, 0.04], [1.2, 0.04], [0.9, 0.27], [2.3, 0.27]], C.a);
        word(t, spons[0], 1.7, 0.155, 0.075, C.base, { spacing: 0.012 });
        word(t, spons[1], -1.45, 0.12, 0.07, C.a, { spacing: 0.012 });
      });
      tops((t) => {
        rect(t, 2.2, 0.0, 1.0, 0.8, C.a); rect(t, 2.2, 0.0, 1.0, -0.8, C.b);
        for (let k = 0; k < 8; k++) if (k % 2) rect(t, 0.2 - k * 0.15, 0.62, 0.05 - k * 0.15, 0.3, C.c); else rect(t, 0.2 - k * 0.15, -0.3, 0.05 - k * 0.15, -0.62, C.c);
        rect(t, 0.4, 0.2, -1.0, -0.2, C.a);
      });
    },
    diamonds(H) {            // a harlequin line of diamonds along the flank and bonnet
      const { sides, tops, poly, rect, word, C, spons } = H;
      sides((t) => {
        rect(t, -2.3, -0.3, 2.3, -0.2, C.c);
        for (let k = 0; k < 9; k++) {
          const z = 2.0 - k * 0.5, cy = 0.0;
          poly(t, [[z + 0.3, cy], [z, cy + 0.3], [z - 0.3, cy], [z, cy - 0.3]], k % 2 ? C.b : C.a);
          poly(t, [[z + 0.16, cy], [z, cy + 0.16], [z - 0.16, cy], [z, cy - 0.16]], k % 2 ? C.a : C.c);
        }
        word(t, spons[0], 1.0, -0.255, 0.05, C.base, { spacing: 0.03 });
      });
      tops((t) => {
        for (let k = 0; k < 4; k++) { const z = 1.9 - k * 0.3; poly(t, [[z + 0.2, 0], [z, 0.3], [z - 0.2, 0], [z, -0.3]], k % 2 ? C.b : C.a); }
        rect(t, 0.4, 0.62, -1.0, -0.62, C.c); rect(t, 0.4, 0.3, -1.0, 0.24, C.a); rect(t, 0.4, -0.24, -1.0, -0.3, C.a);
      });
    },
    zigzag(H) {              // sawtooth bands across the flank, like a heart-rate line
      const { sides, tops, rect, line, word, C, spons } = H;
      const saw = (z0, z1, y0, y1, step) => { const o = []; let k = 0; for (let z = z0; z > z1; z -= step, k++) o.push([z, k % 2 ? y1 : y0]); return o; };
      sides((t) => {
        rect(t, -2.3, -0.3, 2.3, -0.24, C.c);
        line(t, saw(2.3, -2.4, -0.16, 0.2, 0.28), C.b, 0.085); line(t, saw(2.3, -2.4, -0.16, 0.2, 0.28), C.a, 0.045);
        word(t, spons[0], -1.6, 0.04, 0.07, C.b, { spacing: 0.012 });
      });
      tops((t) => {
        line(t, saw(2.2, 0.9, -0.5, 0.5, 0.26), C.a, 0.1);
        rect(t, 0.4, 0.62, -1.0, -0.62, C.c); line(t, saw(0.4, -1.0, -0.4, 0.4, 0.28), C.b, 0.07); rect(t, -1.4, 0.7, -2.2, -0.7, C.a);
      });
    },
    dots(H) {                // comic halftone: big dots near the nose shrinking toward the tail, solid roof
      const { sides, tops, circ, rect, word, C, spons } = H;
      sides((t) => {
        for (let r = 0; r < 5; r++) for (let k = 0; k < 20; k++) {
          const z = 2.25 - k * 0.24 - (r % 2) * 0.12, y = -0.22 + r * 0.115, f = (z + 2.3) / 4.6;
          const rad = 0.014 + 0.05 * f * (0.45 + 0.55 * (1 - Math.abs(y - 0.02) / 0.3));
          circ(t, z, y, rad, r % 2 ? C.b : C.a);
        }
        rect(t, -2.3, -0.3, 2.3, -0.26, C.c);
        word(t, spons[0], 1.35, 0.22, 0.055, C.c, { spacing: 0.012 });
      });
      tops((t) => {
        for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) circ(t, 2.1 - k * 0.2, -0.45 + r * 0.3 + (k % 2) * 0.15, 0.05 + 0.012 * k * 0, k % 2 ? C.b : C.a);
        rect(t, 0.4, 0.62, -1.0, -0.62, C.c); rect(t, -1.4, 0.7, -2.2, -0.7, C.b);
      });
    },
  };

  /* the 14 crews, in the order of DRIVERS (tracks/rivals.js): car 0 = Kestrel body, 1 = Strada body, pod = light bar on the nose */
  const RIVAL_LOOKS = [
    { crew: 'Nordvik Timber',  ci: 0, pod: false, design: 'chevrons',  base: 0x0e8c88, a: 0xe0207a, b: 0xf4f6f8, c: 0x0b2f3a, wheel: 0xf4f6f8, spons: ['NORDVIK', 'SKOGLUND', 'ISFJELL'], plate: 'NV 10-KL' },
    { crew: 'Lumiere',         ci: 1, pod: true,  design: 'bullseye',  base: 0xd7e21c, a: 0x5b1fa8, b: 0x151515, c: 0x151515, wheel: 0x151515, spons: ['LUMIERE', 'PAPILLON', 'BRIQUET'], plate: 'LM 11-MD' },
    { crew: 'Torrone Corse',   ci: 0, pod: true,  design: 'slash',     base: 0xefe6cf, a: 0x8c1c3a, b: 0x222428, c: 0x222428, wheel: 0x8c1c3a, spons: ['TORRONE', 'VELOCE & FIGLI', 'CAMPANILE'], plate: 'TC 12-AR' },
    { crew: 'Nami Works',      ci: 1, pod: false, design: 'waves',     base: 0xff7aa8, a: 0x2b0f5e, b: 0xfff1a8, c: 0x2b0f5e, wheel: 0x2b0f5e, spons: ['NAMI', 'HOSHIZORA', 'KAZEMICHI'], plate: 'NW 13-TK' },
    { crew: 'Baobab Racing',   ci: 0, pod: false, design: 'checkband', base: 0xf26b1d, a: 0x1a1a22, b: 0xf5f0e0, c: 0x1a1a22, wheel: 0xf5f0e0, spons: ['BAOBAB', 'HARMATTAN', 'ADIRE'], plate: 'BR 14-JO' },
    { crew: 'Vltava Rally',    ci: 1, pod: true,  design: 'diamonds',  base: 0xcdb98a, a: 0x2a6b4a, b: 0xe6552b, c: 0x2a2418, wheel: 0x2a2418, spons: ['VLTAVA', 'STRAKA', 'HRAD'], plate: 'VR 15-PN' },
    { crew: 'Stormfall',       ci: 0, pod: true,  design: 'zigzag',    base: 0x241a7a, a: 0xff4fa0, b: 0x7dffd4, c: 0x0d0a33, wheel: 0x7dffd4, spons: ['STORMFALL', 'RUNEWORKS', 'BERGHEIM'], plate: 'SF 16-SH' },
    { crew: 'Marais Frères',   ci: 1, pod: false, design: 'chevrons',  base: 0x7d1535, a: 0x35d0c0, b: 0xf4f6f8, c: 0x2a0a14, wheel: 0x35d0c0, spons: ['MARAIS', 'VENDANGE', 'CHANTEUR'], plate: 'MF 17-LM' },
    { crew: 'Stalmet Boltex',  ci: 1, pod: true,  design: 'slash',     base: 0x4a5560, a: 0xffe14a, b: 0x00c2ff, c: 0x1b2026, wheel: 0xffe14a, spons: ['STALMET', 'BOLTEX', 'ORZEL'], plate: 'SB 18-DK' },
    { crew: 'Ryujin Gear',     ci: 0, pod: false, design: 'bullseye',  base: 0x101820, a: 0xff3d6e, b: 0x00e0a0, c: 0x05080c, wheel: 0xff3d6e, spons: ['RYUJIN', 'KAMINARI', 'TOKI GEAR'], plate: 'RG 19-RI' },
    { crew: 'Puszta Motor',    ci: 0, pod: false, design: 'waves',     base: 0x7b2d26, a: 0xf0a04b, b: 0xfff0d0, c: 0x2e100d, wheel: 0xfff0d0, spons: ['PUSZTA', 'RUSTIKA', 'ZENIT'], plate: 'PM 20-EV' },
    { crew: 'Klarwerk',        ci: 1, pod: true,  design: 'checkband', base: 0xeef1f3, a: 0x00a3e0, b: 0x1a1a1a, c: 0x1a1a1a, wheel: 0x1a1a1a, spons: ['KLARWERK', 'EISENBACH', 'BRANDT & SOHN'], plate: 'KW 21-HB' },
    { crew: 'Kudi Sprint',     ci: 1, pod: false, design: 'dots',      base: 0xffd23f, a: 0xd81b60, b: 0x4a148c, c: 0x2a0a40, wheel: 0xd81b60, spons: ['KUDI', 'AJE MOTORS', 'ILE'], plate: 'KS 22-CO' },
    { crew: 'Tierra Picante',  ci: 0, pod: true,  design: 'diamonds',  base: 0x3e2723, a: 0xb6e32e, b: 0xf5f5f5, c: 0x1a0f0d, wheel: 0xb6e32e, spons: ['TIERRA', 'PICANTE', 'ALBORADA'], plate: 'TP 23-FC' },
  ];
