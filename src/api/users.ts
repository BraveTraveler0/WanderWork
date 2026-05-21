export interface User {
  _id: string
  email?: string
  displayName?: string
  bio?: string
  // Extend as needed
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "https://application-server-cwqu.onrender.com";

export async function getUserById(id: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/users/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}

export async function getUserByIdPost(id: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/users/post/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch user by post: ${res.status}`);
  return res.json();
}

export async function updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
  const res = await fetch(`${BASE_URL}/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update user: ${res.status}`);
  return res.json();
}

export async function deleteAccount(): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/users/deleteAccount`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete account: ${res.status}`);
  return res.json();
}
