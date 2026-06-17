import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl)
console.log('Key:', supabaseAnonKey?.substring(0, 15) + '...')

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

async function testAuth() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Auth Error:', error)
    } else {
      console.log('Auth Data:', data)
    }
  } catch (err) {
    console.error('Caught Exception:', err)
  }
}

testAuth()
