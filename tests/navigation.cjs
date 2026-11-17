const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function scenario(hash) {
 const calls = [];
 const section = { scrollIntoView: () => calls.push('scroll'), setAttribute() {}, focus: () => calls.push('focus') };
 const link = { getAttribute: () => '#inicio', addEventListener: (_, fn) => link.click = fn };
 const location = { hash, pathname: '/', search: '' };
 const document = { getElementById: id => id === 'inicio' ? section : null, querySelectorAll: () => [link] };
 const history = { state: null, replaceState: (_, title, url) => { calls.push(url); location.hash = ''; } };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8'), { document, location, history, requestAnimationFrame: fn => fn() });
 return { calls, link, location };
}
const deep = scenario('#inicio');
assert.deepEqual(deep.calls, ['scroll', 'focus', '/']);
assert.equal(deep.location.hash, '');
const oauth = scenario('#access_token=TOKEN_FICTICIO&refresh_token=FICTICIO');
assert.deepEqual(oauth.calls, []);
assert.match(oauth.location.hash, /access_token/);
const click = scenario('');
let prevented = false;
click.link.click({ preventDefault: () => prevented = true });
assert(prevented);
assert.deepEqual(click.calls, ['scroll', 'focus']);
const modified = scenario('');
modified.link.click({ ctrlKey: true, preventDefault: () => { throw Error('Interceptou nova aba'); } });
assert.deepEqual(modified.calls, []);
console.log('PASS: seções sem hash, foco acessível e fragmento de login preservado');
