const Wallet = {
  "name": "Wallet",
  "type": "object",
  "properties": {
    "user_email": {
      "type": "string",
      "description": "Email del usuario"
    },
    "user_type": {
      "type": "string",
      "enum": ["professor", "student"],
      "description": "Tipo de usuario"
    },
    "balance": {
      "type": "number",
      "default": 0,
      "description": "Balance disponible en USD"
    },
    "pending_balance": {
      "type": "number",
      "default": 0,
      "description": "Balance pendiente de liberación"
    },
    "total_earned": {
      "type": "number",
      "default": 0,
      "description": "Total ganado históricamente"
    },
    "total_withdrawn": {
      "type": "number",
      "default": 0,
      "description": "Total retirado"
    }
  },
  "required": ["user_email", "user_type"]
};

export default Wallet;