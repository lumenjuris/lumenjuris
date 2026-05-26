require("dotenv").config();

// Charge ton app ES module de façon asynchrone
import("./index.js").catch((err) => {
  console.error("Failed to load app:", err);
  process.exit(1);
});
