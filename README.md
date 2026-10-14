# Integrating With HubSpot I: Foundations Practicum

A small Node.js application that reads and creates `Pet` custom object records in HubSpot. It was built for the HubSpot Academy **Integrating With HubSpot I: Foundations** practicum.

## Practicum purpose

The project demonstrates how to authenticate with a HubSpot private app, retrieve CRM custom object records, render them in a server-side Pug view, and create a record from an HTML form.

The configured custom object is:

- Name: `Pet`
- Plural name: `Pets`
- Object type ID: `2-254897435`
- Properties: `name`, `type`, and `description`

[Open the Pets list in the HubSpot developer test account](https://app-eu1.hubspot.com/contacts/149546116/objects/2-254897435/views/all/list).

## Technologies

- Node.js
- Express
- Axios
- dotenv
- Pug
- HTML and CSS
- Node.js test runner

## Install

1. Clone the repository and enter its directory.
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Copy the safe environment template:

   ```bash
   cp .env.example .env
   ```

4. Replace `your_private_app_access_token` in `.env` with a HubSpot private app access token that has read and write access to CRM custom objects.

The expected environment variables are:

```env
HUBSPOT_ACCESS_TOKEN=your_private_app_access_token
HUBSPOT_CUSTOM_OBJECT_TYPE=2-254897435
PORT=3000
```

## Run

Start the server:

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

Run the automated test suite with:

```bash
npm test
```

## Routes

### `GET /`

Requests every page of Pet records from HubSpot and asks for the `name`, `type`, and `description` properties. The records are rendered as a table in `views/homepage.pug`. The page also handles an empty collection and presents a safe error message if the API request fails.

### `GET /update-cobj`

Renders `views/updates.pug`, which contains the Name, Type, and Description form. The form posts back to `/update-cobj`.

### `POST /update-cobj`

Trims and validates the submitted values on the server. Valid input is sent to HubSpot in the following shape:

```json
{
  "properties": {
    "name": "Lucky",
    "type": "Dog",
    "description": "A friendly dog"
  }
}
```

After HubSpot creates the record, the application redirects to `/`, where the refreshed table includes it. Invalid input and API failures return the form with a clear message instead of exposing raw API response data.

## How the HubSpot API integration works

Axios is configured once with the HubSpot CRM v3 objects base URL. The access token is read from `HUBSPOT_ACCESS_TOKEN` and sent in the `Authorization: Bearer ...` header.

- Reading uses `GET /crm/v3/objects/{objectType}` with the three required properties and follows HubSpot pagination until all records have been collected.
- Creating uses `POST /crm/v3/objects/{objectType}` with the validated form values inside the required `properties` object.

## Security

Never commit a HubSpot private app token. The local `.env` file and other environment variants are ignored by Git, while `.env.example` contains placeholders only. Error handling deliberately avoids logging Axios request configuration or raw HubSpot response data because those structures may contain credentials or sensitive details.
