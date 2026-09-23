# Quiz Game — Neon Functions

The site is a static HTML/CSS/JavaScript frontend. One Neon Function provides the API, and Neon Postgres stores questions and each browser's best score. There is no Express server to deploy or keep running.

## What you need

- A Neon account and project
- Node.js 20 or newer
- The Neon CLI

## First-time Neon setup

### 1. Install and sign in to the Neon CLI

```bash
npm install -g neon@latest
neon auth
```

The command opens a browser for Neon sign-in. Return to the terminal when it finishes.

### 2. Link this folder to your Neon project

From this project folder, run this exact command:

```bash
neon link
```

This creates a local `.neon` project pointer for your selected project and branch; it should not be committed.

### 3. Create the database tables

Open the Neon Console, select the same project and branch, then open **SQL Editor**. Copy and run the full contents of [schema.sql](schema.sql).

## Add admin secrets

The function reads these secrets only on Neon. Never put them in `api-config.js`, `script.js`, or commit them to Git.

Neon’s Function screen does not need a separate “Secrets” menu for this project. The secrets are added when you run the deploy command below. Choose your own values for:

| Name                 | Example                                     |
| -------------------- | ------------------------------------------- |
| `ADMIN_USERNAME`     | `admin`                                     |
| `ADMIN_PASSWORD`     | A long, unique password that you choose     |
| `ADMIN_TOKEN_SECRET` | A random secret with at least 32 characters |

Generate the token secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Neon stores those values on the selected Function branch. `DATABASE_URL` is injected automatically, so do **not** create or paste a database connection string yourself.

## Deploy the Function

1. Install the project dependencies:

   ```bash
   npm install
   ```

2. Deploy the `Quiz API` Function first:

   ```bash
   neon function deploy quizapi --src ./functions/quiz-api.js --runtime nodejs24
   ```

3. Add each secret separately. Replace each example value before you run it:

   ```powershell
   neon function deploy quizapi --src ./functions/quiz-api.js --env "ADMIN_USERNAME=admin"
   neon function deploy quizapi --src ./functions/quiz-api.js --env "ADMIN_PASSWORD=REPLACE_WITH_A_LONG_UNIQUE_PASSWORD"
   neon function deploy quizapi --src ./functions/quiz-api.js --env "ADMIN_TOKEN_SECRET=PASTE_THE_GENERATED_RANDOM_SECRET"
   ```

   The Function slug is `quizapi` because Neon slugs allow only lowercase letters and digits. Each `--env` command updates only that named value; it does not require the other secrets again. The source file is `functions/quiz-api.js`.

4. Copy the public HTTPS URL Neon prints for **quizapi**. It looks similar to `https://quizapi-xxxxx.neon.tech`.

5. Open [api-config.js](api-config.js) and replace the placeholder:

   ```js
   window.QUIZ_API_URL = "PASTE_YOUR_NEON_FUNCTION_URL_HERE";
   ```

   with your real Function URL. This URL is public and safe to commit; it is not a secret.

6. Publish the static frontend. GitHub Pages is fine: push the changed files to the branch connected to Pages. Do not upload `.env`, `.env.local`, or `.neon`.

## Verify the deployment

Open your website, click **Admin**, and sign in using `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Add a question with two options, then return to the home screen and click **Play**.

You can also check that the API can read questions from a terminal:

```bash
curl https://YOUR-QUIZ-API-URL/questions
```

An empty `[]` is normal until the first question is added. A JSON error means to recheck the Neon Function logs, the table schema, and the Function environment variables.

## Useful files

- [functions/quiz-api.js](functions/quiz-api.js): secure API and admin login logic.
- [schema.sql](schema.sql): database tables.
- [.env.example](.env.example): names of the three admin secrets only.
- [api-config.js](api-config.js): public Function URL used by the frontend.

The player identity is anonymous and stored in the browser. Each device therefore sees its own best score.
