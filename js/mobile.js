// Text version of TechJourney for phones, tablets and touch screens
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.mobile-tab');
  const sections = document.querySelectorAll('.content-section');

  function show(target) {
    tabs.forEach(tab => {
      const on = tab.dataset.t === target;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-pressed', on);
    });
    sections.forEach(section => section.classList.toggle('active', section.classList.contains(target)));
  }

  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.t)));
  show('kingho');
});
