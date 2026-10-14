'use strict';

const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');

const { createApp, normaliseFormValues, validatePet } = require('../index');

describe('Pet practicum application', () => {
    const createdPets = [];
    const hubSpotService = {
        async getAllPets() {
            return [
                {
                    id: '1',
                    properties: {
                        name: 'Lucky',
                        type: 'Dog',
                        description: 'A friendly dog.'
                    }
                }
            ];
        },
        async createPet(properties) {
            createdPets.push(properties);
            return { id: '2', properties };
        }
    };

    let server;
    let baseUrl;

    before(async () => {
        server = createApp({ hubSpotService }).listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    after(async () => {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    });

    it('renders HubSpot Pet records on the homepage', async () => {
        const response = await fetch(`${baseUrl}/`);
        const html = await response.text();

        assert.equal(response.status, 200);
        assert.match(html, /Add to this table/);
        assert.match(html, /Lucky/);
        assert.match(html, /Dog/);
        assert.match(html, /A friendly dog\./);
    });

    it('renders the create form and required navigation', async () => {
        const response = await fetch(`${baseUrl}/update-cobj`);
        const html = await response.text();

        assert.equal(response.status, 200);
        assert.match(html, /Update Custom Object Form \| Integrating With HubSpot I Practicum/);
        assert.match(html, /Return to the homepage/);
        assert.match(html, /action="\/update-cobj"/);
    });

    it('serves the stylesheet from the public directory', async () => {
        const response = await fetch(`${baseUrl}/css/style.css`);
        const css = await response.text();

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /text\/css/);
        assert.match(css, /\.pet-form/);
    });

    it('rejects missing required values without calling HubSpot', async () => {
        const initialCount = createdPets.length;
        const response = await fetch(`${baseUrl}/update-cobj`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ name: '', type: '', description: '' }),
            redirect: 'manual'
        });
        const html = await response.text();

        assert.equal(response.status, 400);
        assert.equal(createdPets.length, initialCount);
        assert.match(html, /Name is required\./);
        assert.match(html, /Type is required\./);
        assert.match(html, /Description is required\./);
    });

    it('creates a normalised Pet record and redirects home', async () => {
        const response = await fetch(`${baseUrl}/update-cobj`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                name: '  Nova  ',
                type: '  Cat  ',
                description: '  Integration test record  '
            }),
            redirect: 'manual'
        });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/');
        assert.deepEqual(createdPets.at(-1), {
            name: 'Nova',
            type: 'Cat',
            description: 'Integration test record'
        });
    });
});

describe('form validation', () => {
    it('normalises string fields and rejects non-string input', () => {
        assert.deepEqual(normaliseFormValues({
            name: ' Lucky ',
            type: ['Dog'],
            description: ' Friendly '
        }), {
            name: 'Lucky',
            type: '',
            description: 'Friendly'
        });
    });

    it('enforces server-side maximum lengths', () => {
        const errors = validatePet({
            name: 'x'.repeat(151),
            type: 'Dog',
            description: 'Friendly'
        });

        assert.equal(errors.name, 'Name must be 150 characters or fewer.');
    });
});
