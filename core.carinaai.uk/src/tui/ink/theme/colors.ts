const supports256 = process.env.COLORTERM === 'truecolor'
  || (process.env.TERM_PROGRAM ?? '').includes('iTerm')
  || (process.env.TERM ?? '').includes('256color');

export const colors = supports256
  ? {
      primary: '#58a6ff',
      accent: '#a371f7',
      success: '#3fb950',
      warning: '#d29922',
      error: '#f85149',
      dim: '#8b949e',
      background: '#0d1117',
      surface: '#161b22',
      border: '#30363d',
      text: '#e6edf3',
    }
  : {
      primary: 'blue',
      accent: 'magenta',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      dim: 'gray',
      background: 'black',
      surface: 'black',
      border: 'gray',
      text: 'white',
    };
