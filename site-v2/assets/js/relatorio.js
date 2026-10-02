(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = window.VGEngine;
  const F = window.VGForm;
  const M = window.VGMemoria;
  const fmt = (n, casas = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(n);
  const label = (id, prefixo, valor) => {
    if (valor != null && String(valor).trim()) $(id).textContent = prefixo + valor;
    else $(id).hidden = true;
  };
  const card = (rotulo, valor) => {
    const div = document.createElement('div');
    const small = document.createElement('span');
    const strong = document.createElement('strong');
    small.textContent = rotulo;
    strong.textContent = valor;
    div.append(small, strong);
    $('resumo').append(div);
  };
  $('imprimir').addEventListener('click', () => window.print());
  $('data').textContent = 'Emitido em ' + new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  $('voltar').href = 'laboratorio.html' + location.hash;
  try {
    const estado = location.hash ? F.deHash(location.hash) : { ...F.PADRAO };
    const R = E.calcular(F.entradaMotor(estado));
    const mem = M.construir(R);
    label('projeto', 'Projeto: ', estado.projeto);
    label('equipamento', 'Equipamento: ', estado.equipamento);
    label('responsavel', 'Responsável: ', estado.responsavel);
    card('Potência de cálculo', `${fmt(R.p_kw)} kW`);
    card('Rotação', `${fmt(R.n_rpm)} rpm`);
    card('Material', R.material.nome);
    card('Diâmetro mínimo', `${fmt(R.d_min, 2)} mm`);
    card('Diâmetro adotado', `${fmt(R.d_adotado, 1)} mm`);
    card('Situação do eixo', R.status_texto || R.status);
    if (R.mancal) {
      card('Mancal · diâmetro × largura', `${fmt(R.mancal.d, 1)} × ${fmt(R.mancal.l, 1)} mm`);
      card('Filme mínimo', `${fmt(R.mancal.critico.hmin * 1e6, 1)} µm`);
      card('Situação do mancal', R.mancal.status_texto || R.mancal.status);
    } else if (R.mancal_erro) {
      card('Mancal', 'Não calculado: ' + R.mancal_erro);
    }
    $('memoria').textContent = M.comoTexto(mem, R);
    $('conteudo').hidden = false;
  } catch (error) {
    $('erro').hidden = false;
    $('erro').textContent = 'Não foi possível gerar o relatório: ' + (Array.isArray(error.erros) ? error.erros.join(' · ') : error.message || String(error));
  }
})();
