#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');

const DEFAULT_API = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 10000;

function usage() {
  return [
    'Usage:',
    '  snip add <url>',
    '  snip ls',
    '  snip open <code>',
    '  snip help',
  ].join('\n');
}

function apiBase() {
  const value = process.env.SNIP_API || DEFAULT_API;
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('SNIP_API must be a valid http(s) URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SNIP_API must use http or https.');
  }

  return url.origin;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(new URL(path, apiBase()), {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    throw new Error(`Cannot reach the Snip API: ${error.message}`);
  }

  return response;
}

async function responseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The API returned invalid JSON (HTTP ${response.status}).`);
  }
}

async function apiError(response) {
  try {
    const body = await responseJson(response);
    if (body && typeof body.error === 'string') {
      return new Error(body.error);
    }
  } catch {
    // Use the status below when the error response has no JSON body.
  }
  return new Error(`Snip API request failed (HTTP ${response.status}).`);
}

function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Please provide a valid http(s) URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be shortened.');
  }
  return url.href;
}

function formatLinks(links) {
  if (links.length === 0) return 'No links yet.';

  const rows = links.map(({ code, hits, url }) => ({
    code: String(code),
    hits: String(hits),
    url: String(url),
  }));
  const codeWidth = Math.max(4, ...rows.map((row) => row.code.length));
  const hitsWidth = Math.max(4, ...rows.map((row) => row.hits.length));
  const lines = [`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padEnd(hitsWidth)}  URL`];

  for (const row of rows) {
    lines.push(`${row.code.padEnd(codeWidth)}  ${row.hits.padEnd(hitsWidth)}  ${row.url}`);
  }
  return lines.join('\n');
}

function browserCommand(platform, url) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `start "" "${url}"`],
    };
  }
  if (platform === 'darwin') {
    return { command: 'open', args: [url] };
  }
  return { command: 'xdg-open', args: [url] };
}

function launchBrowser(url) {
  const { command, args } = browserCommand(process.platform, url);
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    } catch (error) {
      reject(new Error(`Could not open the browser: ${error.message}`));
      return;
    }
    child.once('error', (error) => reject(new Error(`Could not open the browser: ${error.message}`)));
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function addLink(value) {
  const url = validateUrl(value);
  const response = await request('/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw await apiError(response);

  const link = await responseJson(response);
  if (!link || typeof link.shortUrl !== 'string') {
    throw new Error('The API response is missing shortUrl.');
  }
  console.log(link.shortUrl);
}

async function listLinks() {
  const response = await request('/api/links');
  if (!response.ok) throw await apiError(response);

  const links = await responseJson(response);
  if (!Array.isArray(links)) throw new Error('The API response is not a links array.');
  console.log(formatLinks(links));
}

async function openLink(code) {
  if (!/^[A-Za-z0-9]{6}$/.test(code)) {
    throw new Error('The short code must be six base62 characters.');
  }

  const response = await request(`/${encodeURIComponent(code)}`, { redirect: 'manual' });
  if (response.status === 404) throw new Error(`Unknown short code: ${code}`);
  if (response.status !== 302) {
    if (!response.ok) throw await apiError(response);
    throw new Error(`Expected a redirect, but the API returned HTTP ${response.status}.`);
  }

  const location = response.headers.get('location');
  if (!location) throw new Error('The redirect response is missing its Location header.');

  let target;
  try {
    target = new URL(location);
  } catch {
    throw new Error('The redirect response contains an invalid Location URL.');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('The redirect response contains a non-http(s) Location URL.');
  }
  await launchBrowser(target.href);
}

async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  try {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      if (rest.length) throw new Error('Help does not accept additional arguments.');
      console.log(usage());
      return;
    }

    if (command === 'add') {
      if (rest.length !== 1) throw new Error('Usage: snip add <url>');
      await addLink(rest[0]);
      return;
    }

    if (command === 'ls') {
      if (rest.length !== 0) throw new Error('Usage: snip ls');
      await listLinks();
      return;
    }

    if (command === 'open') {
      if (rest.length !== 1) throw new Error('Usage: snip open <code>');
      await openLink(rest[0]);
      return;
    }

    throw new Error(`Unknown command: ${command}\n${usage()}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { browserCommand, formatLinks, main };
