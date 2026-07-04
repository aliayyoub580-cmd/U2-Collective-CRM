# Daily Quran Ayat Refresh

Set this backend environment variable before running the server:

```env
QURAN_REFRESH_TOKEN=change_this_to_a_secure_random_token
```

Use cron-job.org to call this URL once daily, recommended at 12:05 AM:

```txt
https://your-domain.com/api/quran/daily-refresh?token=YOUR_SECRET_TOKEN
```

The public frontend card reads:

```txt
/api/quran/today
```

The refresh token is backend-only. Do not add it to React frontend code.
