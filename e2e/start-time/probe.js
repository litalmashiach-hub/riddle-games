// TEST ONLY. Put first in <head> of the built page: says when the level map can be tapped.
(() => {
  const say = (m) => console.log('STARTPROBE ' + m + ' ' + Date.now() + ' ' + Math.round(performance.now()));
  say('html');
  const check = () => {
    const card = [...document.querySelectorAll('#root button[aria-label^="Level 1:"]')].find((b) => b.getBoundingClientRect().width > 0);
    if (!card) return setTimeout(check, 5);
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => say('map'), 0)));
  };
  check();
})();
