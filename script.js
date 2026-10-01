(() => {
  'use strict';

  const root = document.documentElement;
  const themeButton = document.querySelector('#theme-toggle');
  const menuButton = document.querySelector('#menu-toggle');
  const menu = document.querySelector('#nav-links');
  const progress = document.querySelector('#top-progress');
  const tabs = [...document.querySelectorAll('.calc-tab')];
  const formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

  function setTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    themeButton.querySelector('.theme-icon').textContent = theme === 'dark' ? '☼' : '☾';
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#09131f' : '#f5f5ef';
    try { localStorage.setItem('vg-theme', theme); } catch (_) { /* Private browsing may block storage. */ }
  }

  let savedTheme = null;
  try { savedTheme = localStorage.getItem('vg-theme'); } catch (_) { /* Use system preference. */ }
  setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  function closeMenu() {
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
  }
  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('is-visible'));
  }

  const sectionLinks = [...menu.querySelectorAll('a[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          sectionLinks.forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
        }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    document.querySelectorAll('main section[id]').forEach(section => activeObserver.observe(section));
  }

  let scrollScheduled = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = max > 0 ? `${Math.min(100, scrollY / max * 100)}%` : '0%';
    scrollScheduled = false;
  }
  addEventListener('scroll', () => {
    if (!scrollScheduled) { requestAnimationFrame(updateProgress); scrollScheduled = true; }
  }, { passive: true });
  addEventListener('resize', updateProgress);
  updateProgress();
  document.querySelector('#year').textContent = new Date().getFullYear();

  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  // Accept either comma or dot as the decimal separator, but never ambiguous
  // thousands formatting. This keeps inputs predictable across browser locales.
  function readNumber(form, name, options = {}) {
    const input = form.elements.namedItem(name);
    const raw = input.value.trim().replace(/\s/g, '');
    const label = input.dataset.label || name;
    const validSyntax = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(raw);
    const value = validSyntax ? Number(raw.replace(',', '.')) : NaN;
    const min = options.min ?? 0;
    const max = options.max ?? Number.POSITIVE_INFINITY;
    const valid = Number.isFinite(value) && value >= min && value <= max && (!options.integer || Number.isInteger(value));
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) {
      let requirement = `um número entre ${formatter.format(min)} e ${formatter.format(max)}`;
      if (!Number.isFinite(max)) requirement = `um número ${min > 0 ? 'maior que zero' : 'igual ou maior que zero'}`;
      if (options.integer) requirement = `um número inteiro entre ${formatter.format(min)} e ${formatter.format(max)}`;
      throw new Error(`${label}: informe ${requirement}.`);
    }
    return value;
  }

  const positive = { min: Number.EPSILON };
  const calculators = {
    synchronous(form) {
      const frequency = readNumber(form, 'frequency', positive);
      const poles = readNumber(form, 'poles', { min: 2, max: 100, integer: true });
      if (poles % 2 !== 0) {
        form.elements.namedItem('poles').setAttribute('aria-invalid', 'true');
        throw new Error('Número de polos: use um inteiro par (2, 4, 6…).');
      }
      return { value: 120 * frequency / poles, unit: 'rpm', detail: `Para ${formatter.format(frequency)} Hz e ${poles} polos.` };
    },
    torque(form) {
      const power = readNumber(form, 'power', positive);
      const rpm = readNumber(form, 'rpm', positive);
      const torque = power * 1000 / (2 * Math.PI * rpm / 60);
      return { value: torque, unit: 'N·m', detail: 'Potência informada como potência mecânica no eixo.' };
    },
    current(form) {
      const power = readNumber(form, 'power', positive);
      const voltage = readNumber(form, 'voltage', positive);
      const powerFactor = readNumber(form, 'powerFactor', { min: Number.EPSILON, max: 1 });
      const efficiency = readNumber(form, 'efficiency', { min: Number.EPSILON, max: 1 });
      const current = power * 1000 / (Math.sqrt(3) * voltage * powerFactor * efficiency);
      return { value: current, unit: 'A', detail: 'Corrente de linha estimada em regime permanente; não representa a corrente de partida.' };
    },
    slip(form) {
      const syncRpm = readNumber(form, 'syncRpm', positive);
      const rotorRpm = readNumber(form, 'rotorRpm', { min: 0 });
      if (rotorRpm > syncRpm) {
        form.elements.namedItem('rotorRpm').setAttribute('aria-invalid', 'true');
        throw new Error('Velocidade do rotor: em regime motor, use valor igual ou menor que a velocidade síncrona.');
      }
      const slip = (syncRpm - rotorRpm) / syncRpm * 100;
      return { value: slip, unit: '%', detail: `Diferença de ${formatter.format(syncRpm - rotorRpm)} rpm entre campo e rotor.` };
    },
    conversion(form) {
      const value = readNumber(form, 'value', { min: 0 });
      const rpmToRad = form.elements.namedItem('direction').value === 'rpm-to-rad';
      return rpmToRad
        ? { value: value * 2 * Math.PI / 60, unit: 'rad/s', detail: `${formatter.format(value)} rpm × 2π / 60` }
        : { value: value * 60 / (2 * Math.PI), unit: 'rpm', detail: `${formatter.format(value)} rad/s × 60 / 2π` };
    }
  };

  document.querySelectorAll('[data-calc-form]').forEach(form => {
    form.addEventListener('input', event => {
      if (event.target.matches('input')) event.target.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      form.querySelectorAll('input').forEach(input => input.removeAttribute('aria-invalid'));
      const result = form.parentElement.querySelector('.calc-result');
      try {
        const output = calculators[form.dataset.calcForm](form);
        if (!Number.isFinite(output.value)) throw new Error('O resultado excedeu o limite numérico. Revise as entradas.');
        result.classList.remove('is-error');
        result.querySelector('strong').textContent = `${formatter.format(output.value)} ${output.unit}`;
        result.querySelector('p').textContent = output.detail;
      } catch (error) {
        result.classList.add('is-error');
        result.querySelector('strong').textContent = 'Confira os dados';
        result.querySelector('p').textContent = error.message;
        form.querySelector('[aria-invalid="true"]')?.focus();
      }
    });
  });

  const conversionDirection = document.querySelector('[name="direction"]');
  conversionDirection.addEventListener('change', () => {
    const isRpm = conversionDirection.value === 'rpm-to-rad';
    document.querySelector('#conversion-unit').textContent = isRpm ? 'rpm' : 'rad/s';
    const input = conversionDirection.form.elements.namedItem('value');
    input.value = isRpm ? '1800' : '188,5';
    const result = conversionDirection.closest('.calc-panel').querySelector('.calc-result');
    result.classList.remove('is-error');
    result.querySelector('strong').textContent = '—';
    result.querySelector('p').textContent = 'Insira o valor e converta.';
  });
})();
