'use strict';

require('dotenv').config();

const path = require('node:path');
const axios = require('axios');
const express = require('express');

const DEFAULT_PORT = 3000;
const DEFAULT_CUSTOM_OBJECT_TYPE = '2-254897435';
const PET_PROPERTIES = ['name', 'type', 'description'];
const FIELD_LIMITS = {
    name: 150,
    type: 100,
    description: 1000
};

const customObjectType = process.env.HUBSPOT_CUSTOM_OBJECT_TYPE || DEFAULT_CUSTOM_OBJECT_TYPE;

function createHubSpotService({ accessToken, objectType = customObjectType } = {}) {
    const requireAccessToken = () => {
        if (!accessToken) {
            throw new Error('HUBSPOT_ACCESS_TOKEN is not configured.');
        }
    };

    const client = axios.create({
        baseURL: 'https://api.hubapi.com/crm/v3/objects',
        timeout: 10000,
        headers: accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
            : { 'Content-Type': 'application/json' }
    });

    const objectPath = `/${encodeURIComponent(objectType)}`;

    return {
        async getAllPets() {
            requireAccessToken();

            const records = [];
            let after;

            do {
                const response = await client.get(objectPath, {
                    params: {
                        properties: PET_PROPERTIES.join(','),
                        limit: 100,
                        ...(after ? { after } : {})
                    }
                });

                records.push(...(response.data.results || []));
                after = response.data.paging?.next?.after;
            } while (after);

            return records;
        },

        async createPet(properties) {
            requireAccessToken();
            const response = await client.post(objectPath, { properties });
            return response.data;
        }
    };
}

function normaliseFormValues(body = {}) {
    return {
        name: typeof body.name === 'string' ? body.name.trim() : '',
        type: typeof body.type === 'string' ? body.type.trim() : '',
        description: typeof body.description === 'string' ? body.description.trim() : ''
    };
}

function validatePet(values) {
    const errors = {};

    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
        if (!values[field]) {
            errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required.`;
        } else if (values[field].length > limit) {
            errors[field] = `${field[0].toUpperCase()}${field.slice(1)} must be ${limit} characters or fewer.`;
        }
    }

    return errors;
}

function logHubSpotError(context, error) {
    const status = error.response?.status;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${context}${status ? ` (HTTP ${status})` : ''}: ${message}`);
}

function createApp({ hubSpotService } = {}) {
    const app = express();
    const petsService = hubSpotService || createHubSpotService({
        accessToken: process.env.HUBSPOT_ACCESS_TOKEN
    });

    app.set('view engine', 'pug');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.urlencoded({ extended: false, limit: '10kb' }));

    app.get('/', async (req, res) => {
        try {
            const pets = await petsService.getAllPets();
            return res.render('homepage', {
                title: 'Pets | Integrating With HubSpot I Practicum',
                pets
            });
        } catch (error) {
            logHubSpotError('Unable to retrieve HubSpot Pet records', error);
            return res.status(502).render('homepage', {
                title: 'Pets | Integrating With HubSpot I Practicum',
                pets: [],
                errorMessage: 'Pet records could not be loaded. Check the HubSpot configuration and try again.'
            });
        }
    });

    app.get('/update-cobj', (req, res) => {
        return res.render('updates', {
            title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
            values: {}
        });
    });

    app.post('/update-cobj', async (req, res) => {
        const values = normaliseFormValues(req.body);
        const errors = validatePet(values);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render('updates', {
                title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
                values,
                errors,
                errorMessage: 'Please correct the highlighted fields.'
            });
        }

        try {
            await petsService.createPet(values);
            return res.redirect('/');
        } catch (error) {
            logHubSpotError('Unable to create a HubSpot Pet record', error);
            return res.status(502).render('updates', {
                title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
                values,
                errorMessage: 'The Pet record could not be created. Please try again.'
            });
        }
    });

    return app;
}

if (require.main === module) {
    const port = Number.parseInt(process.env.PORT, 10) || DEFAULT_PORT;
    createApp().listen(port, () => {
        console.log(`Listening on http://localhost:${port}`);
    });
}

module.exports = {
    createApp,
    createHubSpotService,
    normaliseFormValues,
    validatePet
};
