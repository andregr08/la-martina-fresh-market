const { createClient } = require("@supabase/supabase-js");
const readline = require("readline");

const userId = "1dc8d76c-4cd9-4dab-b7c2-7f72c9e43354";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Nueva contraseña: ", async (password) => {
  const { data, error } =
    await supabase.auth.admin.updateUserById(
      userId,
      { password }
    );

  if (error) {
    console.error("❌ ERROR:", error.message);
  } else {
    console.log("✅ Contraseña cambiada correctamente");
    console.log("Usuario:", data.user.email);
  }

  rl.close();
});
