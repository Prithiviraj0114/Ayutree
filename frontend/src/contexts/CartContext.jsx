import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "./AuthContext";

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/cart");
      setItems(data.items || []);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (product_id, qty = 1) => {
    await api.post("/cart/add", { product_id, qty });
    await refresh();
  };
  const update = async (product_id, qty) => {
    await api.post("/cart/update", { product_id, qty });
    await refresh();
  };
  const remove = async (product_id) => {
    await api.delete(`/cart/${product_id}`);
    await refresh();
  };

  const subtotal = items.reduce((s, it) => s + (it.product?.price || 0) * it.qty, 0);
  const count = items.reduce((s, it) => s + it.qty, 0);

  return (
    <CartCtx.Provider value={{ items, count, subtotal, loading, add, update, remove, refresh }}>
      {children}
    </CartCtx.Provider>
  );
};
