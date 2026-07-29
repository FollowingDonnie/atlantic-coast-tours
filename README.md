# Atlantic Coast Tours

A live customer-engagement chatbot for west-of-Ireland tours. The browser
frontend is hosted on GitHub Pages. A small Node backend on Render protects the
OpenAI API key and gives the model two live function tools:

- `search_tours`: fetches the assigned Google Sheet on every relevant question.
- `check_weather`: geocodes an Irish location and fetches its Open-Meteo forecast.

The Sheet is never copied, cached, or hardcoded into the application.

## Local setup

1. Copy `.env.example` to `.env` and add an OpenAI API key.
2. Run `npm start`.
3. Open `http://localhost:5174`.

No package installation is required. The project uses Node 20 built-ins.

## Commands

```text
npm start
npm test
npm run sync-pages
```

`npm run sync-pages` refreshes the static GitHub Pages files in `docs/`.

## Deployment

- GitHub Pages serves the static frontend from `docs/`.
- Render reads `render.yaml` to create the Node API service.
- Enter `OPENAI_API_KEY` only when Render prompts for the secret.

[Deploy the backend to Render](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2FFollowingDonnie%2Fatlantic-coast-tours)

The free Render service can take around a minute to wake after inactivity.

## Live data

- Google Sheet: CA2 - Atlantic Coast Tours
- Open-Meteo geocoding and forecast APIs

Sheet values are treated as untrusted external data. Instruction-like text in
data cells is removed before results reach the model. Numeric values remain
unchanged, while suspicious prices are explicitly flagged for customer
confirmation.

