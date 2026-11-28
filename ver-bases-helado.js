const fs = require("fs")
const { createClient } = require("@supabase/supabase-js")

const env = {}

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim()

  if (!trimmed || trimmed.startsWith("#")) continue

  const index = trimmed.indexOf("=")

  if (index === -1) continue

  const key = trimmed.slice(0, index).trim()
  let value = trimmed.slice(index + 1).trim()

  value = value.replace(/^["']|["']$/g, "")

  env[key] = value
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error("No encontré las credenciales de Supabase en .env.local")
}

const supabase = createClient(url, key)

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,unit,current_stock,active")
    .eq("active", true)
    .order("name")

  if (error) throw error

  const matches = data.filter((p) => {
    const n = p.name.toLowerCase()

    return (
      n.includes("yog") ||
      n.includes("grieg") ||
      n.includes("taro") ||
      n.includes("helado") ||
      n.includes("base")
    )
  })

  console.log("")
  console.log("=== POSIBLES BASES DE HELADO ===")

  if (matches.length > 0) {
    for (const p of matches) {
      console.log(
        `${p.name} | unidad=${p.unit} | stock=${p.current_stock} | id=${p.id}`
      )
    }
  } else {
    console.log("No encontré coincidencias.")
    console.log("")
    console.log("=== TODOS LOS PRODUCTOS ACTIVOS ===")

    for (const p of data) {
      console.log(
        `${p.name} | unidad=${p.unit} | stock=${p.current_stock}`
      )
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
