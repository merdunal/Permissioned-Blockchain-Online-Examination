#!/bin/bash

echo "🛑 Hyperledger Besu Ağı Durduruluyor..."

# Çalışan tüm besu süreçlerini bul ve güvenli bir şekilde kapat
pkill -TERM -f besu

echo "✅ Tüm node'lar başarıyla durduruldu."
