import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Login: http://localhost:${PORT}/auth/login`);
  console.log(`Sign up: http://localhost:${PORT}/auth/signup`);
});
