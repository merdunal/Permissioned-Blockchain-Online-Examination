#!/bin/bash

echo "🚀 Hyperledger Besu Ağı Başlatılıyor (Metrikler Aktif)..."

# --- YENİ: Prometheus ve Grafana Servislerini Başlat ---
echo "📊 İzleme araçları (Prometheus & Grafana) ayağa kaldırılıyor..."
brew services start prometheus
brew services start grafana
echo "✅ İzleme araçları hazır!"
# -------------------------------------------------------

# Node-1'i başlat ve arka plana at (Metrics Port: 9545)
echo "Node-1 başlatılıyor..."
cd Node-1
besu --data-path=data --genesis-file=../genesis.json --permissions-nodes-config-file-enabled --permissions-accounts-config-file-enabled --rpc-http-enabled --rpc-http-api=ADMIN,ETH,NET,PERM,IBFT --host-allowlist="*" --rpc-http-cors-origins="*" --metrics-enabled=true --metrics-host=127.0.0.1 --metrics-port=9545 --profile=ENTERPRISE > node1.log 2>&1 &
cd ..

# Node-2'yi başlat ve arka plana at (Metrics Port: 9546)
echo "Node-2 başlatılıyor..."
cd Node-2
besu --data-path=data --genesis-file=../genesis.json --permissions-nodes-config-file-enabled --permissions-accounts-config-file-enabled --rpc-http-enabled --rpc-http-api=ADMIN,ETH,NET,PERM,IBFT --host-allowlist="*" --rpc-http-cors-origins="*" --p2p-port=30304 --rpc-http-port=8546 --metrics-enabled=true --metrics-host=127.0.0.1 --metrics-port=9546 --profile=ENTERPRISE > node2.log 2>&1 &
cd ..

# Node-3'ü başlat ve arka plana at (Metrics Port: 9547)
echo "Node-3 başlatılıyor..."
cd Node-3
besu --data-path=data --genesis-file=../genesis.json --permissions-nodes-config-file-enabled --permissions-accounts-config-file-enabled --rpc-http-enabled --rpc-http-api=ADMIN,ETH,NET,PERM,IBFT --host-allowlist="*" --rpc-http-cors-origins="*" --p2p-port=30305 --rpc-http-port=8547 --metrics-enabled=true --metrics-host=127.0.0.1 --metrics-port=9547 --profile=ENTERPRISE > node3.log 2>&1 &
cd ..

# Node-4'ü başlat ve arka plana at (Metrics Port: 9548)
echo "Node-4 başlatılıyor..."
cd Node-4
besu --data-path=data --genesis-file=../genesis.json --permissions-nodes-config-file-enabled --permissions-accounts-config-file-enabled --rpc-http-enabled --rpc-http-api=ADMIN,ETH,NET,PERM,IBFT --host-allowlist="*" --rpc-http-cors-origins="*" --p2p-port=30306 --rpc-http-port=8548 --metrics-enabled=true --metrics-host=127.0.0.1 --metrics-port=9548 --profile=ENTERPRISE > node4.log 2>&1 &
cd ..

echo "✅ Tüm node'lar arka planda çalışıyor! Metrikler aktif (Portlar: 9545, 9546, 9547, 9548). Logları görmek için 'tail -f Node-1/node1.log' komutunu kullanabilirsin."