addEventListener('DOMContentLoaded', () => {
  const API = 'https://api.npms.io/v2';
  const SIZE = 250;

  const {render, html} = uhtml;

  const {round} = Math;
  const {assign, create, keys} = Object;

  const clock = [
    '🕧', '🕜', '🕝', '🕞', '🕟', '🕠',
    '🕡', '🕢', '🕣', '🕤', '🕥', '🕦'
  ];

  const cols = {
    '': '',
    'Name': 'Name',
    '🗺': 'Popularity',
    '⬇': 'Downloads',
    '👍': 'Interest',
    '⛓': 'Dependents'
  };

  let lastSearch = '';
  let preference = sessionStorage.getItem('npm-sort') || cols['🗺'];
  let tick = 0;

  const error = (div, message) => {
    render(div, html`<p>API error 😢 <em>${message}</em></p>`);
  };

  const get = (...args) => fetch(...args).then(body => body.json());

  const isError = obj => keys(obj).sort().join(',') === 'code,message';

  const process = event => {
    event.preventDefault();
    const {currentTarget: form} = event;
    const [input, submit] = form.querySelectorAll('input');
    const maintainer = input.value.trim();
    if (maintainer.length < 1 || lastSearch === maintainer)
      return;

    lastSearch = maintainer;

    const div = document.querySelector('#results');
    const user = `${API}/search?q=maintainer:${maintainer}`;

    const disabled = value => {
      input.disabled = value;
      submit.disabled = value;
    };
    disabled(true);

    tock(div, `Fetching ${maintainer} details`);
    get(`${user}&from=0&size=${SIZE}`).then(async (result) => {
      clearTimeout(tick);
      if (isError(result)) {
        setTimeout(disabled, 1000, false);
        error(div, result.message);
        return;
      }

      const {total, results} = result;
      tock(div, `Fetching ${results.length}/${total} packages`);
      while (results.length < total) {
        const info = await get(
          `${user}&from=${results.length}&size=${SIZE}`
        );
        clearTimeout(tick);
        if (isError(info)) {
          setTimeout(disabled, 1000, false);
          error(div, info.message);
          return;
        }
        results.push(...info.results);
        tock(div, `Fetching ${results.length}/${total} packages`);
      }
      clearTimeout(tick);
      if (total < 1) {
        setTimeout(disabled, 1000, false);
        render(div, html`
          <p>No <strong>${maintainer}</strong> projects found</p>
        `);
        return;
      }

      const names = results.map(({package: {name}}) => name);
      const details = create(null);
      let i = 0;
      tock(div, `Retrieving ${i+1}/${total} details`);
      do {
        const info = await get(`${API}/package/mget`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(names.slice(i, i + SIZE))
        });
        clearTimeout(tick);
        if (isError(info)) {
          disabled(false);
          error(div, info.message);
          return;
        }
        i += keys(info).length;
        assign(details, info);
        tock(div, `Retrieving ${i+1}/${total} details`);
      } while (i < total);
      clearTimeout(tick);
      setTimeout(disabled, 1000, false);
      sort(names, details);
      table(div, names, details);
    });
  };

  const readable = quantity => {
    if ((1000000 - 1) < quantity)
      return `${(quantity/1000000).toFixed(1)}m`;
    if ((1000 - 1) < quantity)
      return `${(quantity/1000).toFixed(1)}k`;
    return `${round(quantity)}`;
  };

  const resort = ($, div, names, details) => {
    sessionStorage.setItem('npm-sort', preference = $);
    sort(names, details);
    table(div, names, details);
  };

  const sort = (names, details) => {
    names.sort((a, b) => {
      switch (preference) {
        case 'Name':
          return a.localeCompare(b);
        case 'Downloads':
          return (
            details[b].evaluation.popularity.downloadsCount -
            details[a].evaluation.popularity.downloadsCount
          );
        case 'Interest':
          return (
            details[b].evaluation.popularity.communityInterest -
            details[a].evaluation.popularity.communityInterest
          );
        case 'Dependents':
          return (
            details[b].evaluation.popularity.dependentsCount -
            details[a].evaluation.popularity.dependentsCount
          );
        default:
          return (
            details[b].score.detail.popularity -
            details[a].score.detail.popularity
          );
      }
    });
  };

  const table = (div, names, details) => {
    render(div, html`
      <table cellpadding="0" cellspacing="0">
        <tr class="sticky">
          ${keys(cols).map(
            name => name ?
              html`<th>
                <button
                  onclick=${e => resort(cols[name], div, names, details)}
                  title="${cols[name]}"
                >${name}</button>
              </th>` :
              html`<th />`
          )}
        </tr>
        ${names.map(name => {
          const {evaluation, score} = details[name];
          return html`
            <tr>
              <td class="counter" />
              <td>
                <a
                  href="${`https://npmjs.org/package/${name}`}"
                  target="_blank"
                >${name}</a>
              </td>
              <td>${round(score.detail.popularity * 100)}%</td>
              <td>${readable(evaluation.popularity.downloadsCount)}</td>
              <td>${readable(evaluation.popularity.communityInterest)}</td>
              <td>${readable(evaluation.popularity.dependentsCount)}</td>
            </tr>
          `;
        })}
      </table>
    `);
  };

  const tock = (div, message) => {
    tick = setTimeout(tock, 250, div, message);
    const now = clock[tick % clock.length];
    render(div, html`<p>${message} ${now}</p>`);
  };

  render(document.querySelector('main'), html`
    <form onsubmit=${process}>
      <label>
        <em>maintainer name</em>
        <input name="maintainer" required autofocus>
      </label>
      <input type="submit">
    </form>
    <div id="results" />
  `);
});
