import crypto from "node:crypto";
import { supabase } from "../lib/supabase";

export type UserRow = {
  id: string;
  username: string;
  password: string; // hashed
  created_at?: string;
};

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export const usersService = {
  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as UserRow) ?? null;
  },
  async findByUsername(username: string): Promise<UserRow | null> {
    const { data, error } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
    if (error) throw error;
    return (data as UserRow) ?? null;
  },
  async create(username: string, password: string): Promise<UserRow> {
    const hashed = hashPassword(password);
    const { data, error } = await supabase
      .from("users")
      .insert({ username, password: hashed })
      .select("*")
      .single();
    if (error) throw error;
    return data as UserRow;
  },
  verifyPassword(password: string, user: UserRow): boolean {
    const hashed = hashPassword(password);
    return hashed === user.password;
  },
};


