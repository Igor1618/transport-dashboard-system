const express = require("express");
const router = express.Router();
const pool = require("../config/database");

router.get("/list", async (req, res) => {
  const { source, vehicle } = req.query;
  try {
    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;
    if (source) { where += " AND source = $" + idx++; params.push(source); }
    if (vehicle) { where += " AND vehicle_number ILIKE $" + idx++; params.push("%" + vehicle + "%"); }
    
    const result = await pool.query("SELECT * FROM fuel_cards " + where + " ORDER BY source, card_number", params);
    res.json({ cards: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/stats", async (req, res) => {
  try {
    // Статистика по картам
    const cardsStats = await pool.query(`
      SELECT 
        source,
        COUNT(*)::int as total_cards,
        COUNT(vehicle_number)::int as linked_cards
      FROM fuel_cards
      GROUP BY source
      ORDER BY source
    `);
    
    // Статистика по транзакциям
    const txStats = await pool.query(`
      SELECT 
        source,
        COALESCE(SUM(quantity), 0)::numeric as total_liters,
        COALESCE(SUM(amount), 0)::numeric as total_amount,
        COUNT(*)::int as transactions
      FROM fuel_transactions
      GROUP BY source
    `);
    
    // Объединяем
    const stats = cardsStats.rows.map(card => {
      const tx = txStats.rows.find(t => t.source === card.source) || {};
      return {
        source: card.source,
        total_cards: card.total_cards,
        linked_cards: card.linked_cards,
        total_liters: tx.total_liters || 0,
        total_amount: tx.total_amount || 0,
        transactions: tx.transactions || 0
      };
    });
    
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/save", async (req, res) => {
  const { id, card_number, source, vehicle_number, driver_name, notes } = req.body;
  try {
    if (id) {
      await pool.query("UPDATE fuel_cards SET vehicle_number=$1, driver_name=$2 WHERE id=$3", [vehicle_number, driver_name, id]);
    } else {
      await pool.query("INSERT INTO fuel_cards (card_number, source, vehicle_number, driver_name, notes) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (source, card_number) DO UPDATE SET vehicle_number=$3", [card_number, source, vehicle_number, driver_name, notes]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM fuel_cards WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;

// Непривязанные транзакции (карты без машин)
router.get("/unlinked", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ft.source,
        ft.card_number,
        fc.notes as card_name,
        fc.driver_name,
        COUNT(*)::int as tx_count,
        SUM(ft.quantity)::numeric as total_liters,
        SUM(ft.amount)::numeric as total_amount,
        MIN(ft.transaction_date) as first_date,
        MAX(ft.transaction_date) as last_date
      FROM fuel_transactions ft
      LEFT JOIN fuel_cards fc ON ft.card_number = fc.card_number AND ft.source = fc.source
      WHERE ft.vehicle_number IS NULL
      GROUP BY ft.source, ft.card_number, fc.notes, fc.driver_name
      ORDER BY total_amount DESC
    `);
    
    const summary = await pool.query(`
      SELECT 
        source,
        COUNT(*)::int as tx_count,
        SUM(quantity)::numeric as total_liters,
        SUM(amount)::numeric as total_amount
      FROM fuel_transactions
      WHERE vehicle_number IS NULL
      GROUP BY source
      ORDER BY total_amount DESC
    `);
    
    res.json({ 
      cards: result.rows,
      summary: summary.rows,
      total: {
        tx_count: result.rows.reduce((s, r) => s + r.tx_count, 0),
        total_liters: result.rows.reduce((s, r) => s + parseFloat(r.total_liters || 0), 0),
        total_amount: result.rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
