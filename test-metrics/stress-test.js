const { ethers } = require("ethers");

// --- AYARLAR ---
// Node-1'in RPC adresi (Varsayılan 8545'tir)
const RPC_URL = "http://127.0.0.1:8545"; 

// DİKKAT: MetaMask'ından (veya test hesaplarından) içi ETH dolu veya 
// ağda işlem yapmaya yetkili bir hesabın Private Key'ini buraya yapıştır.
const PRIVATE_KEY = "8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63"; 

// Ağa fırlatılacak toplam işlem sayısı (Önce 100 ile test et, sonra 500'e çıkar)
const TX_COUNT = 1000; 
// ---------------

async function runStressTest() {
    console.log(`\n🚀 Stres testi başlıyor... Toplam fırlatılacak işlem: ${TX_COUNT}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    try {
        let currentNonce = await provider.getTransactionCount(wallet.address);
        console.log(`Cüzdan Adresi: ${wallet.address} \nBaşlangıç Nonce: ${currentNonce}\n`);

        const txPromises = [];
        const sendTimes = [];

        console.log("İşlemler saniyeler içinde mempool'a yollanıyor...");
        const testStartTime = Date.now();

        for (let i = 0; i < TX_COUNT; i++) {
            // Ağın performansını ölçmek için boş işlem (kendi kendine 0 ETH gönderme) yapıyoruz.
            const tx = {
                to: wallet.address,
                value: 0,
                nonce: currentNonce + i,
                gasLimit: 21000,
                // Besu private IBFT 2.0 ağlarında genelde gasPrice 0'dır. 
                // Eğer hata alırsan bu satırı silip ethers'in otomatik hesaplamasını bekleyebilirsin.
                gasPrice: 0 
            };

            const sendTime = Date.now();
            sendTimes.push(sendTime);

            // İşlemi ağa gönder ve bekleme promise'ini diziye at (Asenkron gönderim)
            const txPromise = wallet.sendTransaction(tx).then(async (response) => {
                const receipt = await response.wait(); // Bloğa yazılmasını bekle
                const mineTime = Date.now();
                return {
                    hash: receipt.hash,
                    latency: mineTime - sendTime,
                    blockNumber: receipt.blockNumber
                };
            });

            txPromises.push(txPromise);
        }

        console.log("✅ Tüm işlemler mempool'a fırlatıldı! Node'ların bunları bloklara dizmesi bekleniyor...\n");

        // Tüm işlemler onaylanana kadar bekle
        const results = await Promise.all(txPromises);
        const testEndTime = Date.now();

        // --- METRİKLERİ HESAPLA ---
        const totalDurationSec = (testEndTime - testStartTime) / 1000;
        const totalLatency = results.reduce((sum, res) => sum + res.latency, 0);
        const avgLatencyMs = totalLatency / TX_COUNT;
        const tps = TX_COUNT / totalDurationSec;

        console.log("📊 --- TEST SONUÇLARI ---");
        console.log(`İşlem Sayısı:        ${TX_COUNT} adet`);
        console.log(`Testin Toplam Süresi:${totalDurationSec.toFixed(2)} saniye`);
        console.log(`Gerçek Latency (Ort):${(avgLatencyMs / 1000).toFixed(2)} saniye`);
        console.log(`Ağ Throughput (TPS): ${tps.toFixed(2)} tx/sn`);
        console.log("------------------------\n");
        console.log("🚨 ŞİMDİ HEMEN GRAFANA EKRANINA GİT VE ŞUNLARA BAK:");
        console.log("1. CPU grafiğindeki sıçramaya");
        console.log("2. Bloklardaki işlem sayısına (Transaction count)");

    } catch (error) {
        console.error("Test sırasında bir hata oluştu:", error);
    }
}

runStressTest();