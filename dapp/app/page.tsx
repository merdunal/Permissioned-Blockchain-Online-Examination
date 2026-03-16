"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { encrypt } from "@metamask/eth-sig-util";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// KENDİ KONTRAT ADRESİNİ BURAYA YAZ
const CONTRACT_ADDRESS = "0x4261D524bc701dA4AC49339e5F8b299977045eA5";

const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjNDc2MzBiYy0wYTBmLTRlODgtOTE3Ni1mOGE3ZTZiYzdmMzciLCJlbWFpbCI6Im1lcnR1bmFsODc4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJiMTVmZTQ1MDNhYzAzN2EwMTA2YSIsInNjb3BlZEtleVNlY3JldCI6ImQwNWExMzA4ZjYxZjAxMGUzNzQzNWMwNjA1NGQyZjYzODAyM2IxNWNiOTlhMTQ1YzQ2NzcwYzA2ZmRhZTAxNDAiLCJleHAiOjE4MDQyNTA1NzF9.IFw2IW4vnh2M8GX0uzhQKtD80oCVevxElb4Vd2vySNc";

const ASSESSMENT_CONTRACT_ADDRESS =
  "0xfE0B7EE21e8298fC68b9Bf5f404e7df7B6671EC2";

const ASSESSMENT_CONTRACT_ABI = [
  "function createAssessment(string, string, uint256, string, address[])",
  "function getDeployedAssessments() view returns (address[])",
  "event AssessmentCreated(address indexed assessmentAddress, address indexed examiner)",
];

// Fabrikanın ürettiği tekil K^(Q) sınav kontratları için ABI
const INDIVIDUAL_ASSESSMENT_ABI = [
  "function examiner() view returns (address)",
  "function fileHash() view returns (string)",
  "function ipfsCID() view returns (string)",
  "function duration() view returns (uint256)",
  "function policy() view returns (string)",
  "function studentAnswers(address) view returns (string, string, uint256)",
  "function submitAnswer(string, string)",
  "function submitGrade(address, string, string)",
  "function finalizeAssessment(string)",
  "function studentGrades(address) view returns (string, string, uint256)",
  "function isGraded(address) view returns (bool)",
  "function requestRetakeArbiter()",
  "function submitRetakeAppeal(string, string)",
  "function submitRetakeDecision(address, bool, string, string)",
  "function retakeAppeals(address) view returns (address, string, string, bool, bool, string, string)",
  "function hasRequestedRetake(address) view returns (bool)",
  "function isCanceled() view returns (bool)",
  "function requestCancelArbiters()",
  "function submitCancelAppeal(string, string)",
  "function submitTeacherCancelDecision(address, string, string)",
  "function voteCancel(address, bool)",
  "function cancelAppeals(address) view returns (address, address, address, address, string, string, string, string, bool, uint8, uint8, bool)",
  "function hasRequestedCancel(address) view returns (bool)",
  "function hasVotedCancel(address, address) view returns (bool)",
  // YENİ EKLENEN NOTA İTİRAZ (GRADE APPEAL) FONKSİYONLARI
  "function requestGradeArbiters()",
  "function submitGradeAppeal(string, string)",
  "function provideAnswerKeyForArbiter(address, string, string)",
  "function submitTeacherGradeReport(address, string, string)",
  "function finalizeGradeAppeal(address, string, string)",
  "function gradeAppeals(address) view returns (address, address, string, string, string, string, bool, string, string, bool, bool)",
  "function hasRequestedGradeAppeal(address) view returns (bool)",
];

// Kontrattaki fonksiyonların arayüzde kullanılabilmesi için ABI güncellendi
const CONTRACT_ABI = [
  "function isAdministrator(address) view returns (bool)",
  "function isTeacher(address) view returns (bool)",
  "function isStudent(address) view returns (bool)",
  "function registerTeacher(address)",
  "function registerStudent(address)",
  "function proposeNewAdmin(address)",
  "function voteAdmin(uint256, uint256)",
  "function executeAdminRegistration(uint256)",
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256) view returns (address, address, uint256, uint256, bool)",
  "function encryptionPublicKeys(address) view returns (string)",
  "function registerEncryptionKey(string)",
];

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Form State'leri (Yönetici Paneli İçin)
  const [teacherAddress, setTeacherAddress] = useState("");
  const [studentAddress, setStudentAddress] = useState("");
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [voteChoice, setVoteChoice] = useState("1");
  const [execProposalId, setExecProposalId] = useState("");

  // --- ÖĞRETMEN PANELİ İÇİN STATE'LER ---
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examDuration, setExamDuration] = useState("");
  const [gradingPolicy, setGradingPolicy] = useState("");
  const [examinees, setExaminees] = useState(""); // Virgülle ayrılmış cüzdan adresleri
  const [isUploading, setIsUploading] = useState(false);

  // --- ÖĞRETMEN DEĞERLENDİRME PANELİ İÇİN STATE'LER ---
  const [evalAssessmentAddress, setEvalAssessmentAddress] = useState("");
  const [evalStudentAddress, setEvalStudentAddress] = useState("");
  const [fetchedAnswerDetails, setFetchedAnswerDetails] = useState<any>(null);
  const [gradeFile, setGradeFile] = useState<File | null>(null);
  const [isGradeSubmitting, setIsGradeSubmitting] = useState(false);
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null); // Kapanış için H(W)

  // EKLENEN STATE: Güncel Oylama ID'si
  const [latestProposalId, setLatestProposalId] = useState<string>("0");

  // EKLENEN STATE: Sınav Oluşturma Sonuçları
  const [assessmentResult, setAssessmentResult] = useState<{
    ipfsCID: string;
    contractAddress: string;
    fileHash: string;
  } | null>(null);

  // --- ÖĞRENCİ PANELİ İÇİN STATE'LER ---
  const [targetAssessmentAddress, setTargetAssessmentAddress] = useState("");
  const [fetchedExamDetails, setFetchedExamDetails] = useState<any>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [isAnswerSubmitting, setIsAnswerSubmitting] = useState(false);
  const [fetchedGradeDetails, setFetchedGradeDetails] = useState<any>(null);

  // --- İTİRAZ (APPEAL) SÜRECİ İÇİN STATE'LER ---
  // Öğrenci Tarafı
  const [appealTargetAddress, setAppealTargetAddress] = useState("");
  const [adminPool, setAdminPool] = useState(""); // Virgülle ayrılmış admin adresleri
  const [appealStatus, setAppealStatus] = useState<any>(null);
  const [appealFile, setAppealFile] = useState<File | null>(null);

  // Yönetici (Hakem) Tarafı
  const [arbiterAssessmentAddress, setArbiterAssessmentAddress] = useState("");
  const [arbiterStudentAddress, setArbiterStudentAddress] = useState("");
  const [fetchedAppealDetails, setFetchedAppealDetails] = useState<any>(null);
  const [decisionFile, setDecisionFile] = useState<File | null>(null);
  const [isDecisionAccepted, setIsDecisionAccepted] = useState(false);

  // --- SINAV İPTALİ (CANCEL APPEAL) İÇİN STATE'LER ---
  // Öğrenci
  const [cancelTargetAddress, setCancelTargetAddress] = useState("");
  const [cancelStatus, setCancelStatus] = useState<any>(null);
  const [cancelAppealFile, setCancelAppealFile] = useState<File | null>(null);

  // Öğretmen Hakem (T_j)
  const [tCancelAssessment, setTCancelAssessment] = useState("");
  const [tCancelStudent, setTCancelStudent] = useState("");
  const [fetchedCancelAppeal, setFetchedCancelAppeal] = useState<any>(null);
  const [teacherReportFile, setTeacherReportFile] = useState<File | null>(null);

  // Yönetici Hakemler (O_j1, O_j2, O_j3)
  const [aCancelAssessment, setACancelAssessment] = useState("");
  const [aCancelStudent, setACancelStudent] = useState("");
  const [fetchedTeacherReport, setFetchedTeacherReport] = useState<any>(null);
  const [cancelVote, setCancelVote] = useState(false);

  // --- NOTA İTİRAZ SÜRECİ (GRADE APPEAL) İÇİN STATE'LER ---
  // 1. Öğrenci (S_j)
  const [gaTargetAddress, setGaTargetAddress] = useState("");
  const [gaStatus, setGaStatus] = useState<any>(null);
  const [gaAppealFile, setGaAppealFile] = useState<File | null>(null);

  // 2. Asıl Öğretmen (Examiner - T)
  const [gaExAssessment, setGaExAssessment] = useState("");
  const [gaExStudent, setGaExStudent] = useState("");
  const [gaExAnswerKeyFile, setGaExAnswerKeyFile] = useState<File | null>(null);

  // 3. Hakem Öğretmen (T_j)
  const [gaTAssessment, setGaTAssessment] = useState("");
  const [gaTStudent, setGaTStudent] = useState("");
  const [gaTFetchedData, setGaTFetchedData] = useState<any>(null);
  const [gaTReportFile, setGaTReportFile] = useState<File | null>(null);

  // 4. Hakem Yönetici (O_j)
  const [gaAAssessment, setGaAAssessment] = useState("");
  const [gaAStudent, setGaAStudent] = useState("");
  const [gaAFetchedReport, setGaAFetchedReport] = useState<any>(null);
  const [gaANewGradeFile, setGaANewGradeFile] = useState<File | null>(null);

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        setLoading(true);
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        const currentAccount = accounts[0];
        setAccount(currentAccount);
        await checkUserRole(currentAccount);
      } catch (error) {
        console.error("Cüzdan bağlanırken hata:", error);
      } finally {
        setLoading(false);
      }
    } else {
      alert("Lütfen MetaMask eklentisini kurun!");
    }
  };

  const checkUserRole = async (userAddress: string) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider,
      );

      const isAdmin = await contract.isAdministrator(userAddress);
      const isTeacher = await contract.isTeacher(userAddress);
      const isStudent = await contract.isStudent(userAddress);

      if (isAdmin) setRole("Administrator");
      else if (isTeacher) setRole("Teacher");
      else if (isStudent) setRole("Student");
      else setRole("Unregistered");

      // Son oylama ID'sini çek (Sadece Adminler için faydalı ama genelde çekilebilir)
      const pCount = await contract.proposalCount();
      setLatestProposalId(pCount.toString());

      // Kullanıcıya kolaylık olsun diye inputları otomatik doldur
      setProposalId(pCount.toString());
      setExecProposalId(pCount.toString());
    } catch (error) {
      console.error("Rol sorgulama hatası:", error);
    }
  };

  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          checkUserRole(accounts[0]);
        } else {
          setAccount(null);
          setRole(null);
        }
      });
    }
  }, []);

  // --- İŞLEM FONKSİYONLARI (SADECE YÖNETİCİLER İÇİN) ---

  // Yazma işlemi yapabilmek için Signer (İmzalayıcı) alan yardımcı fonksiyon
  const getContractWithSigner = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const handleRegisterTeacher = async () => {
    try {
      const contract = await getContractWithSigner();
      const tx = await contract.registerTeacher(teacherAddress);
      alert("İşlem ağa gönderildi. Bekleniyor...");
      await tx.wait(); // Bloğa yazılmasını bekle
      alert("Öğretmen başarıyla kaydedildi!");
      setTeacherAddress("");
    } catch (error: any) {
      alert("Hata oluştu: " + (error.reason || error.message));
    }
  };

  const handleRegisterStudent = async () => {
    try {
      const contract = await getContractWithSigner();
      const tx = await contract.registerStudent(studentAddress);
      alert("İşlem ağa gönderildi. Bekleniyor...");
      await tx.wait();
      alert("Öğrenci başarıyla kaydedildi!");
      setStudentAddress("");
    } catch (error: any) {
      alert("Hata oluştu: " + (error.reason || error.message));
    }
  };

  const handleProposeAdmin = async () => {
    try {
      const contract = await getContractWithSigner();
      const tx = await contract.proposeNewAdmin(newAdminAddress);
      alert("İşlem ağa gönderildi. Bekleniyor...");
      await tx.wait();
      alert("Yeni yönetici adayı oylamaya sunuldu!");
      setNewAdminAddress("");

      // Yeni oylama açıldığı için bilgileri güncelle
      if (account) {
        await checkUserRole(account);
      }
    } catch (error: any) {
      alert("Hata oluştu: " + (error.reason || error.message));
    }
  };

  const handleVoteAdmin = async () => {
    try {
      const contract = await getContractWithSigner();
      const tx = await contract.voteAdmin(proposalId, voteChoice);
      alert("İşlem ağa gönderildi. Bekleniyor...");
      await tx.wait();
      alert("Oyunuz başarıyla kaydedildi!");
    } catch (error: any) {
      alert("Hata oluştu: " + (error.reason || error.message));
    }
  };

  const handleExecuteAdmin = async () => {
    try {
      const contract = await getContractWithSigner();

      // Oylama sonucunu önceden okuyoruz
      const proposal = await contract.proposals(execProposalId);
      const yesVotes = Number(proposal[2]); // struct'taki yesVotes sırası
      const noVotes = Number(proposal[3]); // struct'taki noVotes sırası

      const tx = await contract.executeAdminRegistration(execProposalId);
      alert("İşlem ağa gönderildi. Bekleniyor...");
      await tx.wait();

      // Makaledeki mantığa göre ekrana detaylı sonuç bas
      if (noVotes > yesVotes) {
        alert(
          `Oylama sonucu işlendi: OY ÇOKLUĞUYLA REDDEDİLDİ (${yesVotes} Kabul, ${noVotes} Ret)`,
        );
      } else {
        alert(
          `Oylama sonucu işlendi: OY ÇOKLUĞUYLA KABUL EDİLDİ (${yesVotes} Kabul, ${noVotes} Ret)`,
        );
      }

      setExecProposalId("");
    } catch (error: any) {
      alert("Hata oluştu: " + (error.reason || error.message));
    }
  };

  const handleRegisterPublicKey = async () => {
    try {
      if (!account) return;

      // MetaMask'tan Öğrencinin Encryption Public Key'ini istiyoruz
      const pubKey = await window.ethereum.request({
        method: "eth_getEncryptionPublicKey",
        params: [account],
      });

      // Akıllı kontrata bu anahtarı kaydediyoruz (RoleRegistration kontratını çağırıyoruz)
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      const tx = await roleContract.registerEncryptionKey(pubKey);
      alert("İşlem ağa gönderildi, bekleniyor...");
      await tx.wait();

      alert(
        "Şifreleme Anahtarınız (Public Key) başarıyla blockchain'e kaydedildi!",
      );
    } catch (error: any) {
      alert("Hata oluştu: " + error.message);
    }
  };

  // --- YARDIMCI FONKSİYONLAR ---

  // 1. Dosyanın orijinal SHA-256 özetini (H(Q)) hesaplama
  const calculateFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    // Tarayıcının yerleşik kriptografi API'sini kullanıyoruz
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Byte dizisini Hexadecimal (16'lık taban) string'e çeviriyoruz
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return "0x" + hashHex; // Blockchain standartlarına uygun olması için başına 0x ekliyoruz
  };

  // 2. IPFS'e dosya yükleme (Pinata API)
  const uploadToIPFS = async (
    file: File,
    metadataObj: any,
  ): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    // Pinata üzerinde dosyanın yanına arama yapabilmek için metadata ekliyoruz
    const pinataMetadata = JSON.stringify({
      name: `Assessment_${Date.now()}`,
      keyvalues: {
        duration: metadataObj.duration,
        policy: metadataObj.policy,
      },
    });
    formData.append("pinataMetadata", pinataMetadata);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error("IPFS yüklemesi başarısız oldu.");
    }

    const resData = await res.json();
    return resData.IpfsHash; // Bize IPFS CID değerini (Örn: Qm...) döndürür
  };

  // ArrayBuffer veya Uint8Array'i Base64 string'e çeviren güncellenmiş yardımcı fonksiyon
  const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array) => {
    let binary = "";
    // Gelen veri zaten Uint8Array ise doğrudan kullan, değilse Uint8Array'e çevir
    const bytes =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // 3. Makaledeki Enc(Q, {S_i1...}) Şifreleme Algoritması
  const encryptExamFile = async (
    file: File,
    examinees: string[],
    roleContract: any,
  ) => {
    // 1. Dosyayı AES-GCM ile şifrelemek için rastgele bir AES anahtarı ve IV üret
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const arrayBuffer = await file.arrayBuffer();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      aesKey,
      "AES-GCM",
      true,
      ["encrypt"],
    );

    // PDF'i şifrele
    const encryptedFileBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      arrayBuffer,
    );
    const encryptedFileBase64 = arrayBufferToBase64(encryptedFileBuffer);
    const aesKeyBase64 = arrayBufferToBase64(aesKey);
    const ivBase64 = arrayBufferToBase64(iv);

    // 2. AES Anahtarını öğrencilerin Public Key'leri ile asimetrik olarak şifrele
    const encryptedKeysForStudents: Record<string, any> = {};

    for (const studentAddress of examinees) {
      // Kontrattan öğrencinin Public Key'ini çek
      const studentPubKey =
        await roleContract.encryptionPublicKeys(studentAddress);

      if (!studentPubKey || studentPubKey === "") {
        // HATA MESAJI GÜNCELLENDİ
        throw new Error(
          `${studentAddress} adresli kullanıcının Public Key'i blockchain'de bulunamadı!`,
        );
      }

      // AES anahtarı ve IV'yi JSON yapıp öğrencinin anahtarıyla şifrele
      const dataToEncrypt = JSON.stringify({
        aesKey: aesKeyBase64,
        iv: ivBase64,
      });

      const encryptedData = encrypt({
        publicKey: studentPubKey,
        data: dataToEncrypt,
        version: "x25519-xsalsa20-poly1305",
      });

      encryptedKeysForStudents[studentAddress] = encryptedData;
    }

    // 3. Şifreli Dosyayı ve Şifreli AES Anahtarlarını paketle
    const finalPayload = {
      encryptedFile: encryptedFileBase64,
      encryptedKeys: encryptedKeysForStudents,
    };

    // IPFS'e yüklenmek üzere File objesine çevir
    const blob = new Blob([JSON.stringify(finalPayload)], {
      type: "application/json",
    });
    return new File([blob], "EncryptedAssessment.json", {
      type: "application/json",
    });
  };

  // Base64 string'i ArrayBuffer'a çeviren yardımcı fonksiyon (Şifre çözme için gerekli)
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // MAKALEDEKİ ADIM: Sınavı İndir, Şifreyi Çöz ve Bütünlüğü (Hash) Doğrula
  const handleFetchAndDecryptExam = async () => {
    if (!targetAssessmentAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const examContract = new ethers.Contract(
        targetAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        provider,
      );

      // 1. Kontrattan H(Q), CID, Öğretmen adresi ve Metadatayı çek
      const originalHash = await examContract.fileHash();
      const ipfsCID = await examContract.ipfsCID();
      const examinerAddress = await examContract.examiner();
      const examDuration = await examContract.duration(); // YENİ
      const examPolicy = await examContract.policy(); // YENİ

      console.log("IPFS'ten şifreli dosya indiriliyor...");
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCID}`);
      const encryptedData = await res.json();

      // 2. Öğrencinin kendine ait şifreli AES anahtarını bul
      const normalizedAccount = account.toLowerCase();
      const matchedAddress = Object.keys(encryptedData.encryptedKeys).find(
        (addr) => addr.toLowerCase() === normalizedAccount,
      );

      const myEncryptedKey = matchedAddress
        ? encryptedData.encryptedKeys[matchedAddress]
        : undefined;

      if (!myEncryptedKey)
        throw new Error(
          "Bu sınava giriş yetkiniz bulunmuyor (Anahtarınız yok)!",
        );

      // --- EKLENEN / GÜNCELLENEN KISIM BAŞLANGICI ---
      // MetaMask eth_decrypt fonksiyonu obje değil, Hex formatında string bekler.
      // Objeyi önce metne (JSON.stringify), sonra da Hex string'e çeviriyoruz:
      const stringifiedKey = JSON.stringify(myEncryptedKey);
      const hexEncodedKey =
        "0x" +
        Array.from(new TextEncoder().encode(stringifiedKey))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      console.log("MetaMask ile şifre çözülüyor...");
      // 3. MetaMask üzerinden Öğrencinin Gizli Anahtarı (Private Key) ile AES şifresini çöz
      const decryptedKeyString = await window.ethereum.request({
        method: "eth_decrypt",
        params: [hexEncodedKey, account], // Burada myEncryptedKey yerine hexEncodedKey gönderiyoruz!
      });
      // --- EKLENEN / GÜNCELLENEN KISIM BİTİŞİ ---

      const { aesKey, iv } = JSON.parse(decryptedKeyString);
      const aesKeyBuffer = base64ToArrayBuffer(aesKey);
      const ivBuffer = base64ToArrayBuffer(iv);
      const encryptedFileBuffer = base64ToArrayBuffer(
        encryptedData.encryptedFile,
      );

      // 4. Çözülen AES anahtarı ile PDF dosyasını çöz
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        aesKeyBuffer,
        "AES-GCM",
        true,
        ["decrypt"],
      );
      const decryptedFileBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        cryptoKey,
        encryptedFileBuffer,
      );

      // 5. MAKALEDEKİ KONTROL: Çözülen dosyanın özetini (H(Q')) hesapla ve kontrattaki (H(Q)) ile karşılaştır
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        decryptedFileBuffer,
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedHash =
        "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (calculatedHash !== originalHash) {
        throw new Error(
          "GÜVENLİK İHLALİ: Dosya bütünlüğü bozulmuş! Hesaplanan hash, kontrattaki ile eşleşmiyor.",
        );
      }

      alert("Şifre başarıyla çözüldü ve dosya bütünlüğü (Hash) doğrulandı!");

      // Dosyayı tarayıcıda indirmek için link oluştur
      const blob = new Blob([decryptedFileBuffer], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);

      setFetchedExamDetails({
        examiner: examinerAddress,
        duration: examDuration.toString(), // YENİ
        policy: examPolicy, // YENİ
        downloadUrl: downloadUrl,
      });
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // MAKALEDEKİ ADIM: Cevapları Öğretmenin Anahtarıyla Şifrele ve Yükle
  const handleSubmitAnswer = async () => {
    if (!answerFile || !fetchedExamDetails) return;
    try {
      setIsAnswerSubmitting(true);

      // 1. Cevap dosyasının özetini (H(A)) hesapla
      const answerHash = await calculateFileHash(answerFile);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      // 2. Makaledeki kural: Cevaplar SADECE öğretmenin (T) kimliği ile şifrelenir
      const examinerAddress = fetchedExamDetails.examiner;
      // encryptExamFile fonksiyonumuzu kullanarak cevap dosyasını sadece öğretmene özel şifreliyoruz
      const encryptedAnswerFile = await encryptExamFile(
        answerFile,
        [examinerAddress],
        roleContract,
      );

      // 3. Şifreli cevabı IPFS'e yükle
      console.log("Şifreli cevap IPFS'e yükleniyor...");
      const answerCID = await uploadToIPFS(encryptedAnswerFile, {
        type: "Answer",
        student: account,
      });

      // 4. H(A) özetini ve CID'yi akıllı kontrata (K^Q) gönder
      console.log("Cevap özeti akıllı kontrata gönderiliyor...");
      const examContract = new ethers.Contract(
        targetAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const tx = await examContract.submitAnswer(answerHash, answerCID);

      alert("İşlem ağa gönderildi, onay bekleniyor...");
      await tx.wait();

      alert(
        "Tebrikler! Cevaplarınız başarıyla şifrelendi, IPFS'e yüklendi ve Blockchain'e kaydedildi.",
      );
    } catch (error: any) {
      alert("Cevap yüklenirken hata: " + error.message);
    } finally {
      setIsAnswerSubmitting(false);
    }
  };

  // MAKALEDEKİ ADIM: Öğrenci Kendi Notunu İndirir ve Şifresini Çözer
  const handleFetchAndDecryptGrade = async () => {
    if (!targetAssessmentAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const examContract = new ethers.Contract(
        targetAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        provider,
      );

      // 1. Öğretmen notu girmiş mi kontrol et
      const graded = await examContract.isGraded(account);
      if (!graded) {
        throw new Error("Öğretmen henüz notunuzu sisteme girmemiş.");
      }

      // 2. Kontrattan öğrencinin H(G) özetini ve Not CID'sini çek
      const gradeData = await examContract.studentGrades(account);
      const gradeHash = gradeData[0];
      const gradeCID = gradeData[1];

      console.log("IPFS'ten şifreli not indiriliyor...");
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${gradeCID}`);
      const encryptedData = await res.json();

      // 3. Öğrenci kendi AES anahtarını arıyor
      const normalizedAccount = account.toLowerCase();
      const matchedAddress = Object.keys(encryptedData.encryptedKeys).find(
        (addr) => addr.toLowerCase() === normalizedAccount,
      );

      const myEncryptedKey = matchedAddress
        ? encryptedData.encryptedKeys[matchedAddress]
        : undefined;
      if (!myEncryptedKey)
        throw new Error(
          "Şifreleme hatası: Not dosyası sizin anahtarınızla şifrelenmemiş.",
        );

      const stringifiedKey = JSON.stringify(myEncryptedKey);
      const hexEncodedKey =
        "0x" +
        Array.from(new TextEncoder().encode(stringifiedKey))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      console.log("MetaMask ile notun şifresi çözülüyor...");
      const decryptedKeyString = await window.ethereum.request({
        method: "eth_decrypt",
        params: [hexEncodedKey, account],
      });

      const { aesKey, iv } = JSON.parse(decryptedKeyString);
      const aesKeyBuffer = base64ToArrayBuffer(aesKey);
      const ivBuffer = base64ToArrayBuffer(iv);
      const encryptedFileBuffer = base64ToArrayBuffer(
        encryptedData.encryptedFile,
      );

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        aesKeyBuffer,
        "AES-GCM",
        true,
        ["decrypt"],
      );
      const decryptedFileBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        cryptoKey,
        encryptedFileBuffer,
      );

      // 4. MAKALEDEKİ KONTROL: Çözülen dosyanın özetini hesapla ve kontrattaki H(G) ile karşılaştır
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        decryptedFileBuffer,
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedHash =
        "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (calculatedHash !== gradeHash) {
        throw new Error(
          "GÜVENLİK İHLALİ: Not dosyasının bütünlüğü bozulmuş! Hesaplanan hash, kontrattaki ile eşleşmiyor.",
        );
      }

      alert("Not dosyanızın şifresi başarıyla çözüldü ve bütünlük doğrulandı!");

      const blob = new Blob([decryptedFileBuffer], { type: "application/pdf" }); // Notların PDF olduğunu varsayıyoruz
      const downloadUrl = URL.createObjectURL(blob);

      setFetchedGradeDetails({
        downloadUrl: downloadUrl,
      });
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // MAKALEDEKİ ADIM: Öğretmen Öğrencinin Şifreli Cevabını Çözer ve Doğrular
  const handleFetchAndDecryptAnswer = async () => {
    if (!evalAssessmentAddress || !evalStudentAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const examContract = new ethers.Contract(
        evalAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        provider,
      );

      // Sadece öğretmenin işlemi yapabilmesi kontrolü
      const examinerAddress = await examContract.examiner();
      if (examinerAddress.toLowerCase() !== account.toLowerCase()) {
        throw new Error(
          "Sadece bu sınavı oluşturan öğretmen değerlendirme yapabilir!",
        );
      }

      // Kontrattan öğrencinin H(A) özetini ve cevap CID'sini çek
      const studentAnswerData =
        await examContract.studentAnswers(evalStudentAddress);
      const answerHash = studentAnswerData[0];
      const answerCID = studentAnswerData[1];

      if (!answerCID || answerCID === "") {
        throw new Error("Bu öğrenci henüz bir cevap yüklememiş.");
      }

      console.log("IPFS'ten öğrencinin şifreli cevabı indiriliyor...");
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${answerCID}`);
      const encryptedData = await res.json();

      // Öğretmen kendi AES anahtarını arıyor
      const normalizedAccount = account.toLowerCase();
      const matchedAddress = Object.keys(encryptedData.encryptedKeys).find(
        (addr) => addr.toLowerCase() === normalizedAccount,
      );

      const myEncryptedKey = matchedAddress
        ? encryptedData.encryptedKeys[matchedAddress]
        : undefined;
      if (!myEncryptedKey)
        throw new Error(
          "Şifreleme hatası: Dosya sizin anahtarınızla şifrelenmemiş.",
        );

      const stringifiedKey = JSON.stringify(myEncryptedKey);
      const hexEncodedKey =
        "0x" +
        Array.from(new TextEncoder().encode(stringifiedKey))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      console.log("MetaMask ile öğrencinin cevabı çözülüyor...");
      const decryptedKeyString = await window.ethereum.request({
        method: "eth_decrypt",
        params: [hexEncodedKey, account],
      });

      const { aesKey, iv } = JSON.parse(decryptedKeyString);
      const aesKeyBuffer = base64ToArrayBuffer(aesKey);
      const ivBuffer = base64ToArrayBuffer(iv);
      const encryptedFileBuffer = base64ToArrayBuffer(
        encryptedData.encryptedFile,
      );

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        aesKeyBuffer,
        "AES-GCM",
        true,
        ["decrypt"],
      );
      const decryptedFileBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        cryptoKey,
        encryptedFileBuffer,
      );

      // MAKALEDEKİ KONTROL: Çözülen dosyanın özetini hesapla ve kontrattaki H(A) ile karşılaştır
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        decryptedFileBuffer,
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedHash =
        "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (calculatedHash !== answerHash) {
        throw new Error(
          "GÜVENLİK İHLALİ: Cevap dosyasının bütünlüğü bozulmuş! Hesaplanan hash, kontrattaki ile eşleşmiyor.",
        );
      }

      alert("Cevap şifresi başarıyla çözüldü ve bütünlük doğrulandı!");

      const blob = new Blob([decryptedFileBuffer], { type: "application/pdf" }); // Cevapların PDF olduğunu varsayıyoruz
      const downloadUrl = URL.createObjectURL(blob);

      setFetchedAnswerDetails({
        student: evalStudentAddress,
        downloadUrl: downloadUrl,
      });
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // MAKALEDEKİ ADIM: Notları Öğrencinin Anahtarıyla Şifrele ve Yükle
  const handleSubmitGrade = async () => {
    if (!gradeFile || !fetchedAnswerDetails || !evalAssessmentAddress) return;
    try {
      setIsGradeSubmitting(true);

      const gradeHash = await calculateFileHash(gradeFile); // H(G)

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      // Makaledeki kural: Notlar öğrencinin kimliği ile şifrelenir
      const studentAddress = fetchedAnswerDetails.student;
      const encryptedGradeFile = await encryptExamFile(
        gradeFile,
        [studentAddress],
        roleContract,
      );

      console.log("Şifreli Not IPFS'e yükleniyor...");
      const gradeCID = await uploadToIPFS(encryptedGradeFile, {
        type: "Grade",
        student: studentAddress,
      });

      console.log("H(G) özeti akıllı kontrata gönderiliyor...");
      const examContract = new ethers.Contract(
        evalAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const tx = await examContract.submitGrade(
        studentAddress,
        gradeHash,
        gradeCID,
      );

      alert("Notlandırılıyor... İşlem ağa gönderildi.");
      await tx.wait();

      alert("Harika! Öğrencinin notu şifrelendi ve Blockchain'e işlendi.");
      setGradeFile(null); // Başarılı olunca temizle
    } catch (error: any) {
      alert("Not yüklenirken hata: " + error.message);
    } finally {
      setIsGradeSubmitting(false);
    }
  };

  // MAKALEDEKİ ADIM: Sınavı Kapatma (Closure Message)
  const handleFinalizeAssessment = async () => {
    if (!answerSheetFile || !evalAssessmentAddress) return;
    try {
      setIsUploading(true);
      const answerSheetHash = await calculateFileHash(answerSheetFile); // H(W)

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        evalAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      const tx = await examContract.finalizeAssessment(answerSheetHash);
      alert("Kapanış mesajı ağa gönderiliyor...");
      await tx.wait();

      alert("Sınav süreci başarıyla kapatıldı! (Closure Message yayınlandı).");
    } catch (error: any) {
      alert("Kapatılırken hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 1. ÖĞRENCİ: Hakem Talep Et ve Durumu Kontrol Et
  const handleCheckOrRequestArbiter = async (isRequesting: boolean) => {
    if (!appealTargetAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        appealTargetAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      if (isRequesting) {
        // DÜZELTME: Artık parametre göndermiyoruz. Kontrat kendisi rastgele seçecek!
        const tx = await examContract.requestRetakeArbiter();
        alert(
          "Rastgele Hakem ataması için ağa istek gönderildi. Bekleniyor...",
        );
        await tx.wait();
        alert("Hakem başarıyla atandı!");
      }

      // Durumu Kontrol Et
      const hasRequested = await examContract.hasRequestedRetake(account);
      if (hasRequested) {
        const appealData = await examContract.retakeAppeals(account);
        setAppealStatus({
          arbiter: appealData[0],
          appealCID: appealData[2],
          isResolved: appealData[3],
          isAccepted: appealData[4],
          decisionCID: appealData[6],
        });
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 2. ÖĞRENCİ: Dilekçeyi Şifrele ve Hakeme Gönder
  const handleSubmitRetakeAppeal = async () => {
    if (
      !appealFile ||
      !appealStatus ||
      !appealStatus.arbiter ||
      !appealTargetAddress
    )
      return;
    try {
      setIsUploading(true);
      const appealHash = await calculateFileHash(appealFile);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );
      const examContract = new ethers.Contract(
        appealTargetAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      // MAKALEDEKİ KURAL: Dilekçe (L) sadece Hakem (O_j) için şifrelenir
      const encryptedAppeal = await encryptExamFile(
        appealFile,
        [appealStatus.arbiter],
        roleContract,
      );
      const appealCID = await uploadToIPFS(encryptedAppeal, {
        type: "Appeal",
        student: account,
      });

      const tx = await examContract.submitRetakeAppeal(appealHash, appealCID);
      alert("İtiraz dilekçeniz Hakeme gönderiliyor...");
      await tx.wait();

      alert("İtirazınız başarıyla şifrelendi ve Hakeme iletildi!");
      handleCheckOrRequestArbiter(false); // Durumu güncelle
    } catch (error: any) {
      alert("İtiraz gönderilirken hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 3. YÖNETİCİ (HAKEM): İtirazı Oku ve Kararı Şifrele
  const handleArbiterProcessAppeal = async (action: "fetch" | "submit") => {
    if (!arbiterAssessmentAddress || !arbiterStudentAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        arbiterAssessmentAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      const appealData = await examContract.retakeAppeals(
        arbiterStudentAddress,
      );
      const assignedArbiter = appealData[0];
      const appealHash = appealData[1];
      const appealCID = appealData[2];

      if (assignedArbiter.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Bu itiraz dosyası için yetkili Hakem siz değilsiniz!");
      }

      if (action === "fetch") {
        if (!appealCID) throw new Error("Öğrenci henüz dilekçe yüklememiş.");

        // Şifre Çözme İşlemi (Hakem kendi anahtarıyla çözüyor)
        const res = await fetch(
          `https://gateway.pinata.cloud/ipfs/${appealCID}`,
        );
        const encryptedData = await res.json();
        const normalizedAccount = account.toLowerCase();
        const matchedAddress = Object.keys(encryptedData.encryptedKeys).find(
          (addr) => addr.toLowerCase() === normalizedAccount,
        );
        const myEncryptedKey = matchedAddress
          ? encryptedData.encryptedKeys[matchedAddress]
          : undefined;
        if (!myEncryptedKey)
          throw new Error("Dilekçe sizin anahtarınızla şifrelenmemiş.");

        const stringifiedKey = JSON.stringify(myEncryptedKey);
        const hexEncodedKey =
          "0x" +
          Array.from(new TextEncoder().encode(stringifiedKey))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        const decryptedKeyString = await window.ethereum.request({
          method: "eth_decrypt",
          params: [hexEncodedKey, account],
        });
        const { aesKey, iv } = JSON.parse(decryptedKeyString);

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          base64ToArrayBuffer(aesKey),
          "AES-GCM",
          true,
          ["decrypt"],
        );
        const decryptedFileBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
          cryptoKey,
          base64ToArrayBuffer(encryptedData.encryptedFile),
        );

        const calculatedHash =
          "0x" +
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest("SHA-256", decryptedFileBuffer),
            ),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        if (calculatedHash !== appealHash)
          throw new Error("GÜVENLİK İHLALİ: Dilekçe bütünlüğü bozulmuş!");

        const downloadUrl = URL.createObjectURL(
          new Blob([decryptedFileBuffer], { type: "application/pdf" }),
        );
        setFetchedAppealDetails({
          student: arbiterStudentAddress,
          downloadUrl,
        });
        alert("Öğrencinin itiraz dilekçesi başarıyla çözüldü!");
      } else if (action === "submit") {
        if (!decisionFile) throw new Error("Lütfen karar PDF'ini yükleyin.");

        const decisionHash = await calculateFileHash(decisionFile);

        // MAKALEDEKİ KURAL: Karar (R veya B), öğrencinin anahtarıyla şifrelenir
        let encryptFor = [arbiterStudentAddress];
        if (isDecisionAccepted) {
          // Kabul edilirse öğretmenin de okuyabilmesi için öğretmenin adresini de ekliyoruz
          const examinerAddress = await examContract.examiner();
          encryptFor.push(examinerAddress);
        }

        const encryptedDecision = await encryptExamFile(
          decisionFile,
          encryptFor,
          roleContract,
        );
        const decisionCID = await uploadToIPFS(encryptedDecision, {
          type: "Decision",
          student: arbiterStudentAddress,
        });

        const tx = await examContract.submitRetakeDecision(
          arbiterStudentAddress,
          isDecisionAccepted,
          decisionHash,
          decisionCID,
        );
        alert("Kararınız ağa gönderiliyor...");
        await tx.wait();
        alert("Karar başarıyla şifrelendi ve sisteme işlendi!");
        setFetchedAppealDetails(null);
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 1. ÖĞRENCİ: İptal Hakemlerini (1 Öğretmen, 3 Admin) Talep Et ve Durumu Kontrol Et
  const handleCheckOrRequestCancelArbiters = async (isRequesting: boolean) => {
    if (!cancelTargetAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        cancelTargetAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      if (isRequesting) {
        const tx = await examContract.requestCancelArbiters();
        alert("4 Hakemin rastgele atanması için ağa istek gönderildi...");
        await tx.wait();
        alert("Hakemler başarıyla atandı!");
      }

      const hasRequested = await examContract.hasRequestedCancel(account);
      if (hasRequested) {
        const appealData = await examContract.cancelAppeals(account);
        setCancelStatus({
          teacherArbiter: appealData[0],
          adminArbiter1: appealData[1],
          adminArbiter2: appealData[2],
          adminArbiter3: appealData[3],
          appealCID: appealData[5],
          teacherDecisionCID: appealData[7],
          teacherReported: appealData[8],
          yesVotes: appealData[9],
          noVotes: appealData[10],
          isResolved: appealData[11],
        });
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 2. ÖĞRENCİ: İptal Dilekçesini 4 Hakem İçin Şifrele ve Yükle
  const handleSubmitCancelAppeal = async () => {
    if (!cancelAppealFile || !cancelStatus || !cancelTargetAddress) return;
    try {
      setIsUploading(true);
      const appealHash = await calculateFileHash(cancelAppealFile);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );
      const examContract = new ethers.Contract(
        cancelTargetAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      // MAKALEDEKİ KURAL: Dilekçe 4 hakem için de ayrı ayrı şifrelenir
      const arbiters = [
        cancelStatus.teacherArbiter,
        cancelStatus.adminArbiter1,
        cancelStatus.adminArbiter2,
        cancelStatus.adminArbiter3,
      ];
      const encryptedAppeal = await encryptExamFile(
        cancelAppealFile,
        arbiters,
        roleContract,
      );
      const appealCID = await uploadToIPFS(encryptedAppeal, {
        type: "CancelAppeal",
        student: account,
      });

      const tx = await examContract.submitCancelAppeal(appealHash, appealCID);
      alert("Dilekçeniz Hakemlere gönderiliyor...");
      await tx.wait();

      alert("Başarılı! Dilekçeniz 4 hakeme özel şifrelenip iletildi.");
      handleCheckOrRequestCancelArbiters(false);
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 3. ÖĞRETMEN HAKEM (T_j): Öğrencinin Dilekçesini Çöz ve Kendi Raporunu Şifrele
  const handleTeacherCancelProcess = async (action: "fetch" | "submit") => {
    if (!tCancelAssessment || !tCancelStudent || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        tCancelAssessment,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      const appealData = await examContract.cancelAppeals(tCancelStudent);
      if (appealData[0].toLowerCase() !== account.toLowerCase())
        throw new Error("Bu dosya için Öğretmen Hakem siz değilsiniz!");

      if (action === "fetch") {
        if (!appealData[5]) throw new Error("Öğrenci dilekçe yüklememiş.");
        const res = await fetch(
          `https://gateway.pinata.cloud/ipfs/${appealData[5]}`,
        );
        const encryptedData = await res.json();
        const myKey =
          encryptedData.encryptedKeys[
            Object.keys(encryptedData.encryptedKeys).find(
              (addr) => addr.toLowerCase() === account.toLowerCase(),
            ) || ""
          ];
        if (!myKey) throw new Error("Dilekçe size özel şifrelenmemiş.");

        const hexKey =
          "0x" +
          Array.from(new TextEncoder().encode(JSON.stringify(myKey)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        const decKeyString = await window.ethereum.request({
          method: "eth_decrypt",
          params: [hexKey, account],
        });
        const { aesKey, iv } = JSON.parse(decKeyString);

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          base64ToArrayBuffer(aesKey),
          "AES-GCM",
          true,
          ["decrypt"],
        );
        const decBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
          cryptoKey,
          base64ToArrayBuffer(encryptedData.encryptedFile),
        );

        const calcHash =
          "0x" +
          Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", decBuffer)),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        if (calcHash !== appealData[4]) throw new Error("Bütünlük bozulmuş!");

        setFetchedCancelAppeal({
          downloadUrl: URL.createObjectURL(
            new Blob([decBuffer], { type: "application/pdf" }),
          ),
          admin1: appealData[1],
          admin2: appealData[2],
          admin3: appealData[3],
        });
        alert("Dilekçe başarıyla çözüldü!");
      } else if (action === "submit") {
        if (!teacherReportFile || !fetchedCancelAppeal)
          throw new Error("Rapor dosyasını seçin.");
        const reportHash = await calculateFileHash(teacherReportFile);

        // MAKALEDEKİ KURAL: Öğretmen raporu SADECE 3 Yönetici Hakem için şifrelenir
        const admins = [
          fetchedCancelAppeal.admin1,
          fetchedCancelAppeal.admin2,
          fetchedCancelAppeal.admin3,
        ];
        const encryptedReport = await encryptExamFile(
          teacherReportFile,
          admins,
          roleContract,
        );
        const reportCID = await uploadToIPFS(encryptedReport, {
          type: "TeacherReport",
          student: tCancelStudent,
        });

        const tx = await examContract.submitTeacherCancelDecision(
          tCancelStudent,
          reportHash,
          reportCID,
        );
        alert("Rapor Yöneticilere gönderiliyor...");
        await tx.wait();
        alert(
          "Başarılı! Raporunuz şifrelendi ve oylama için Yöneticilere sunuldu.",
        );
        setFetchedCancelAppeal(null);
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 4. YÖNETİCİ HAKEMLER (O_j): Öğretmenin Raporunu Çöz ve Oy Ver
  const handleAdminCancelProcess = async (action: "fetch" | "vote") => {
    if (!aCancelAssessment || !aCancelStudent || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        aCancelAssessment,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      const appealData = await examContract.cancelAppeals(aCancelStudent);
      const isAdminArbiter = [appealData[1], appealData[2], appealData[3]].some(
        (addr) => addr.toLowerCase() === account.toLowerCase(),
      );
      if (!isAdminArbiter)
        throw new Error(
          "Siz bu oylama için yetkili bir Yönetici Hakem değilsiniz!",
        );
      if (!appealData[8])
        throw new Error(
          "Öğretmen Hakem henüz raporunu sunmamış. Oylama başlatılamaz.",
        );

      if (action === "fetch") {
        const res = await fetch(
          `https://gateway.pinata.cloud/ipfs/${appealData[7]}`,
        );
        const encryptedData = await res.json();
        const myKey =
          encryptedData.encryptedKeys[
            Object.keys(encryptedData.encryptedKeys).find(
              (addr) => addr.toLowerCase() === account.toLowerCase(),
            ) || ""
          ];
        if (!myKey) throw new Error("Rapor size özel şifrelenmemiş.");

        const hexKey =
          "0x" +
          Array.from(new TextEncoder().encode(JSON.stringify(myKey)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        const decKeyString = await window.ethereum.request({
          method: "eth_decrypt",
          params: [hexKey, account],
        });
        const { aesKey, iv } = JSON.parse(decKeyString);

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          base64ToArrayBuffer(aesKey),
          "AES-GCM",
          true,
          ["decrypt"],
        );
        const decBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
          cryptoKey,
          base64ToArrayBuffer(encryptedData.encryptedFile),
        );

        const calcHash =
          "0x" +
          Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", decBuffer)),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        if (calcHash !== appealData[6])
          throw new Error("Rapor bütünlüğü bozulmuş!");

        setFetchedTeacherReport({
          downloadUrl: URL.createObjectURL(
            new Blob([decBuffer], { type: "application/pdf" }),
          ),
        });
        alert("Öğretmen Hakemin Raporu başarıyla çözüldü!");
      } else if (action === "vote") {
        const tx = await examContract.voteCancel(aCancelStudent, cancelVote);
        alert("Oyunuz ağa iletiliyor...");
        await tx.wait();
        alert("Oyunuz başarıyla kaydedildi!");
        setFetchedTeacherReport(null);
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 1. ÖĞRENCİ: Hakemleri Talep Et ve Dilekçeyi Şifrele
  const handleGradeAppealStudent = async (
    action: "request" | "submit" | "check",
  ) => {
    if (!gaTargetAddress || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        gaTargetAddress,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );

      if (action === "request") {
        const tx = await examContract.requestGradeArbiters();
        alert("Hakem ataması için ağa istek gönderildi...");
        await tx.wait();
        alert("Hakemler (1 Öğretmen, 1 Yönetici) başarıyla atandı!");
      }

      if (action === "check" || action === "request") {
        const hasReq = await examContract.hasRequestedGradeAppeal(account);
        if (hasReq) {
          const data = await examContract.gradeAppeals(account);
          setGaStatus({
            tArbiter: data[0],
            aArbiter: data[1],
            appealCID: data[3],
            keyProvided: data[6],
            tReported: data[9],
            isResolved: data[10],
          });
        }
      }

      if (action === "submit") {
        if (!gaAppealFile || !gaStatus)
          throw new Error("Dosya veya durum eksik.");
        const hash = await calculateFileHash(gaAppealFile);
        const roleContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer,
        );

        // MAKALEDEKİ KURAL: Dilekçe hem Hakem Öğretmen hem Hakem Yönetici için şifrelenir
        const encrypted = await encryptExamFile(
          gaAppealFile,
          [gaStatus.tArbiter, gaStatus.aArbiter],
          roleContract,
        );
        const cid = await uploadToIPFS(encrypted, {
          type: "GradeAppeal",
          student: account,
        });
        const tx = await examContract.submitGradeAppeal(hash, cid);
        await tx.wait();
        alert("Dilekçe başarıyla şifrelendi ve hakemlere iletildi!");
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 2. ASIL ÖĞRETMEN: Cevap Anahtarını (W) Hakem Öğretmen (T_j) İçin Şifrele
  const handleGradeAppealExaminer = async () => {
    if (!gaExAssessment || !gaExStudent || !gaExAnswerKeyFile || !account)
      return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        gaExAssessment,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      const examinerAddr = await examContract.examiner();
      if (examinerAddr.toLowerCase() !== account.toLowerCase())
        throw new Error("Sınavın asıl sahibi siz değilsiniz!");

      const data = await examContract.gradeAppeals(gaExStudent);
      const tArbiter = data[0]; // Hakem Öğretmen

      const hash = await calculateFileHash(gaExAnswerKeyFile);
      // MAKALEDEKİ KURAL: Cevap anahtarı SADECE Hakem Öğretmen için şifrelenir
      const encrypted = await encryptExamFile(
        gaExAnswerKeyFile,
        [tArbiter],
        roleContract,
      );
      const cid = await uploadToIPFS(encrypted, {
        type: "AnswerKey",
        student: gaExStudent,
      });

      const tx = await examContract.provideAnswerKeyForArbiter(
        gaExStudent,
        hash,
        cid,
      );
      await tx.wait();
      alert("Cevap anahtarı Hakem Öğretmene şifreli olarak iletildi!");
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 3. HAKEM ÖĞRETMEN (T_j): Verileri Çöz ve Raporu (B_L) Hakem Yönetici (O_j) İçin Şifrele
  const handleGradeAppealTeacherArbiter = async (
    action: "fetch" | "submit",
  ) => {
    if (!gaTAssessment || !gaTStudent || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        gaTAssessment,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      const data = await examContract.gradeAppeals(gaTStudent);
      if (data[0].toLowerCase() !== account.toLowerCase())
        throw new Error("Hakem Öğretmen siz değilsiniz!");

      if (action === "fetch") {
        if (!data[3] || !data[5])
          throw new Error("Dilekçe veya Cevap Anahtarı henüz yüklenmemiş.");
        alert("Şifreler çözülüyor, lütfen MetaMask'tan onay verin...");

        // Yardımcı fonksiyon: IPFS'ten çek ve çöz
        const fetchAndDecrypt = async (cid: string) => {
          const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
          const encData = await res.json();
          const myKey =
            encData.encryptedKeys[
              Object.keys(encData.encryptedKeys).find(
                (addr) => addr.toLowerCase() === account.toLowerCase(),
              ) || ""
            ];
          if (!myKey) throw new Error("Dosya sizin için şifrelenmemiş.");
          const hexKey =
            "0x" +
            Array.from(new TextEncoder().encode(JSON.stringify(myKey)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          const decKeyString = await window.ethereum.request({
            method: "eth_decrypt",
            params: [hexKey, account],
          });
          const { aesKey, iv } = JSON.parse(decKeyString);
          const cryptoKey = await crypto.subtle.importKey(
            "raw",
            base64ToArrayBuffer(aesKey),
            "AES-GCM",
            true,
            ["decrypt"],
          );
          return await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
            cryptoKey,
            base64ToArrayBuffer(encData.encryptedFile),
          );
        };

        const appealBuffer = await fetchAndDecrypt(data[3]);
        const keyBuffer = await fetchAndDecrypt(data[5]);

        setGaTFetchedData({
          appealUrl: URL.createObjectURL(
            new Blob([appealBuffer], { type: "application/pdf" }),
          ),
          keyUrl: URL.createObjectURL(
            new Blob([keyBuffer], { type: "application/pdf" }),
          ),
          aArbiter: data[1],
        });
        alert("Öğrenci Dilekçesi ve Cevap Anahtarı başarıyla çözüldü!");
      } else if (action === "submit") {
        if (!gaTReportFile || !gaTFetchedData)
          throw new Error("Rapor dosyasını seçin.");
        const hash = await calculateFileHash(gaTReportFile);
        // MAKALEDEKİ KURAL: Rapor SADECE Hakem Yönetici için şifrelenir
        const encrypted = await encryptExamFile(
          gaTReportFile,
          [gaTFetchedData.aArbiter],
          roleContract,
        );
        const cid = await uploadToIPFS(encrypted, {
          type: "TeacherGradeReport",
          student: gaTStudent,
        });

        const tx = await examContract.submitTeacherGradeReport(
          gaTStudent,
          hash,
          cid,
        );
        await tx.wait();
        alert("Rapor başarıyla Hakem Yöneticiye iletildi!");
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 4. HAKEM YÖNETİCİ (O_j): Raporu Çöz ve Yeni Notu Şifrele
  const handleGradeAppealAdminArbiter = async (action: "fetch" | "submit") => {
    if (!gaAAssessment || !gaAStudent || !account) return;
    try {
      setIsUploading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const examContract = new ethers.Contract(
        gaAAssessment,
        INDIVIDUAL_ASSESSMENT_ABI,
        signer,
      );
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      const data = await examContract.gradeAppeals(gaAStudent);
      if (data[1].toLowerCase() !== account.toLowerCase())
        throw new Error("Hakem Yönetici siz değilsiniz!");

      if (action === "fetch") {
        if (!data[8]) throw new Error("Hakem Öğretmen henüz rapor yüklememiş.");
        const res = await fetch(`https://gateway.pinata.cloud/ipfs/${data[8]}`);
        const encData = await res.json();
        const myKey =
          encData.encryptedKeys[
            Object.keys(encData.encryptedKeys).find(
              (addr) => addr.toLowerCase() === account.toLowerCase(),
            ) || ""
          ];

        const hexKey =
          "0x" +
          Array.from(new TextEncoder().encode(JSON.stringify(myKey)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        const decKeyString = await window.ethereum.request({
          method: "eth_decrypt",
          params: [hexKey, account],
        });
        const { aesKey, iv } = JSON.parse(decKeyString);
        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          base64ToArrayBuffer(aesKey),
          "AES-GCM",
          true,
          ["decrypt"],
        );
        const decBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
          cryptoKey,
          base64ToArrayBuffer(encData.encryptedFile),
        );

        setGaAFetchedReport({
          url: URL.createObjectURL(
            new Blob([decBuffer], { type: "application/pdf" }),
          ),
        });
        alert("Öğretmen Raporu başarıyla çözüldü!");
      } else if (action === "submit") {
        if (!gaANewGradeFile) throw new Error("Yeni not dosyasını seçin.");
        const hash = await calculateFileHash(gaANewGradeFile);
        const examinerAddr = await examContract.examiner();

        // MAKALEDEKİ KURAL: Yeni not Öğrenci ve Asıl Öğretmen için şifrelenir
        const encrypted = await encryptExamFile(
          gaANewGradeFile,
          [gaAStudent, examinerAddr],
          roleContract,
        );
        const cid = await uploadToIPFS(encrypted, {
          type: "NewGrade",
          student: gaAStudent,
        });

        const tx = await examContract.finalizeGradeAppeal(
          gaAStudent,
          hash,
          cid,
        );
        await tx.wait();
        alert("Süreç Tamamlandı! Yeni not ağa işlendi.");
      }
    } catch (error: any) {
      alert("Hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateAssessment = async () => {
    if (!examFile || !examDuration || !examinees) {
      alert(
        "Lütfen sınav dosyasını, süresini ve öğrenci adreslerini eksiksiz girin.",
      );
      return;
    }

    try {
      setIsUploading(true);
      const examineeArray = examinees.split(",").map((addr) => addr.trim());

      // AŞAMA 1: Sınav dosyasının şifrelenmeden önceki orijinal özetini (H(Q)) hesapla
      console.log("1. Aşama: Orijinal dosyanın H(Q) özeti hesaplanıyor...");
      const originalHash = await calculateFileHash(examFile);
      console.log("Hesaplanan H(Q):", originalHash);

      // AŞAMA 2: Metadata (M^Q) objesini hazırla
      const metadata = {
        duration: examDuration,
        policy: gradingPolicy,
        examinees: examineeArray,
      };

      // AŞAMA 3: Şifreleme (Encryption) Enc(Q, {S_i1...})
      console.log(
        "3. Aşama: Dosya öğrencilerin anahtarlarıyla şifreleniyor...",
      );

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Öğrencilerin Public Key'lerini okumak için RoleRegistration kontratına bağlanıyoruz
      const roleContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer,
      );

      // Şifreleme fonksiyonunu çağır (Orijinal dosya yerine şifreli bir dosya elde ediyoruz)
      const encryptedFile = await encryptExamFile(
        examFile,
        examineeArray,
        roleContract,
      );
      console.log("Şifreleme başarılı!");

      // AŞAMA 4: Şifrelenmiş Dosyayı ve Metadatayı IPFS'e (Buluta) Yükle
      console.log("4. Aşama: Şifreli paket IPFS'e (Pinata) yükleniyor...");
      const ipfsCID = await uploadToIPFS(encryptedFile, metadata);
      console.log("IPFS'e başarıyla yüklendi! CID:", ipfsCID);

      // AŞAMA 5: Akıllı Kontrata (Factory) Gönderme
      console.log(
        `5. Aşama: Akıllı Kontrata (AssessmentFactory) veriler gönderiliyor...`,
      );

      // Sınav fabrikası kontratına bağlanıyoruz
      const assessmentContract = new ethers.Contract(
        ASSESSMENT_CONTRACT_ADDRESS,
        ASSESSMENT_CONTRACT_ABI,
        signer,
      );

      // Fabrikadaki createAssessment fonksiyonunu çağırıyoruz
      const tx = await assessmentContract.createAssessment(
        originalHash, // _fileHash
        ipfsCID, // _ipfsCID
        Number(examDuration), // _duration
        gradingPolicy, // _policy
        examineeArray, // _examinees
      );

      alert(
        `Sınav Şifrelendi ve IPFS'e Yüklendi (CID: ${ipfsCID}).\nŞimdi blockchain onayı bekleniyor, lütfen bekleyin...`,
      );

      const receipt = await tx.wait(); // İşlemin bloğa yazılmasını bekle

      // YENİ MİMARİ: Factory tarafından üretilen YENİ K^(Q) kontratının adresini loglardan yakala
      let newAssessmentContractAddress = "";
      for (const log of receipt.logs) {
        try {
          const parsedLog = assessmentContract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === "AssessmentCreated") {
            newAssessmentContractAddress = parsedLog.args[0]; // 0. index 'assessmentAddress'
            break;
          }
        } catch (e) {
          // Kendi kontratımıza ait olmayan logları yoksay
        }
      }

      alert(
        `Harika! Sınav başarıyla şifrelendi ve IPFS'e yüklendi!\n\n` +
          `Makale Mimarisindeki Yeni K^(Q) Sınav Kontratınız Üretildi:\n` +
          `Sınav Kontrat Adresi: ${newAssessmentContractAddress}`,
      );

      setAssessmentResult({
        ipfsCID: ipfsCID,
        contractAddress: newAssessmentContractAddress,
        fileHash: originalHash,
      });
    } catch (error: any) {
      console.error(error);
      alert("Sınav oluşturulurken hata: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Metni panoya kopyalayan yardımcı fonksiyon
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} başarıyla panoya kopyalandı!`); // Kullanıcıya geri bildirim
  };







  // --- KRİPTOGRAFİ PERFORMANS TESTİ (BENCHMARK) ---
  const handleCryptoBenchmark = async (file: File | null) => {
    if (!file) return;
    try {
      console.log(`\n📊 --- ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) TESTİ ---`);

      // Dosyayı tarayıcı hafızasına alma
      const arrayBuffer = await file.arrayBuffer();

      // 1. ŞİFRELEME (ENCRYPTION) SÜRECİ
      const encStartTime = performance.now();
      
      // AES-GCM Anahtarı ve IV oluştur (Senin sisteminle birebir aynı)
      const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      // Dosyayı AES ile şifrele
      const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, arrayBuffer);
      
      const encEndTime = performance.now();
      const encDuration = encEndTime - encStartTime;
      console.log(`🔒 Şifreleme (Encryption) Süresi: ${encDuration.toFixed(2)} ms`);

      // 2. ŞİFRE ÇÖZME (DECRYPTION) SÜRECİ
      const decStartTime = performance.now();
      
      // Şifreli dosyayı AES anahtarı ile çöz
      const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, aesKey, encryptedBuffer);
      
      const decEndTime = performance.now();
      const decDuration = decEndTime - decStartTime;
      console.log(`🔓 Şifre Çözme (Decryption) Süresi: ${decDuration.toFixed(2)} ms`);
      console.log("---------------------------------------------------\n");
      
      alert(`${file.name} testi tamamlandı! Sonuçları tarayıcı konsolundan (F12) inceleyin.`);

    } catch (error) {
      console.error("Test Hatası:", error);
      alert("Hata oluştu, konsola bakın.");
    }
  };







  // --- EKRAN ÇİZİM ALANI ---
  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-6 text-black">
          Blockchain Sınav Sistemi
        </h1>
        <button
          onClick={connectWallet}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
        >
          {loading ? "Bağlanıyor..." : "MetaMask ile Bağlan"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center border-b pb-4 mb-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Bağlı Cüzdan:</p>
            <p className="font-mono text-sm text-black">{account}</p>
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold">
            Rol: {role || "Yükleniyor..."}
          </div>
        </div>

        {/* --- YÖNETİCİ PANELİ --- */}
        {role === "Administrator" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-green-800 border-b pb-2">
              Yönetici Kontrol Paneli
            </h2>

            {/* YÖNETİCİ AÇIK ANAHTAR KAYDI (Hakemlik İçin Zorunlu) */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg border border-green-200 shadow-sm mb-6">
              <div>
                <h3 className="font-bold text-green-900">
                  Güvenlik (Hakemlik İçin Zorunlu)
                </h3>
                <p className="text-sm text-gray-600">
                  Öğrencilerin size gizli itiraz dilekçeleri gönderebilmesi için
                  Public Key'inizi ağa kaydetmelisiniz.
                </p>
              </div>
              <button
                onClick={handleRegisterPublicKey}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-2 sm:mt-0 font-semibold shadow"
              >
                🔑 Anahtarımı Ağa Duyur
              </button>
            </div>

            {/* --- HAKEM (ARBITER) PANELİ --- */}
            <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200 shadow-sm mb-6">
              <h3 className="text-xl font-bold text-indigo-900 border-b border-indigo-200 pb-2 mb-4">
                Hakem Paneli (İtiraz Değerlendirme)
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Sınav Akıllı Kontrat Adresi (K^Q)"
                  value={arbiterAssessmentAddress}
                  onChange={(e) => setArbiterAssessmentAddress(e.target.value)}
                  className="w-full p-2 border border-indigo-300 rounded text-black"
                />
                <input
                  type="text"
                  placeholder="İtiraz Eden Öğrenci Adresi"
                  value={arbiterStudentAddress}
                  onChange={(e) => setArbiterStudentAddress(e.target.value)}
                  className="w-full p-2 border border-indigo-300 rounded text-black"
                />
                <button
                  onClick={() => handleArbiterProcessAppeal("fetch")}
                  disabled={isUploading}
                  className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {isUploading
                    ? "İşleniyor..."
                    : "İtiraz Dilekçesini Getir ve Çöz"}
                </button>
              </div>

              {fetchedAppealDetails && (
                <div className="mt-4 p-4 bg-white border border-indigo-300 rounded-lg shadow-inner">
                  <div className="flex justify-between items-center border-b pb-2 mb-4">
                    <h4 className="font-bold text-indigo-800">Dilekçe Hazır</h4>
                    <a
                      href={fetchedAppealDetails.downloadUrl}
                      download="Itiraz_Dilekcesi.pdf"
                      className="bg-green-600 text-white px-4 py-1 rounded shadow hover:bg-green-700 text-sm font-bold"
                    >
                      PDF'i İndir
                    </a>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2 text-black font-semibold">
                      <input
                        type="checkbox"
                        checked={isDecisionAccepted}
                        onChange={(e) =>
                          setIsDecisionAccepted(e.target.checked)
                        }
                        className="w-5 h-5"
                      />
                      <span>
                        İtirazı KABUL ET (Tekrar sınava girme hakkı ver)
                      </span>
                    </label>
                    <p className="text-xs text-gray-500">
                      Kabul veya Ret gerekçenizi içeren PDF karar dosyasını
                      yükleyin:
                    </p>
                    <input
                      type="file"
                      onChange={(e) =>
                        setDecisionFile(
                          e.target.files ? e.target.files[0] : null,
                        )
                      }
                      className="w-full p-2 border border-indigo-300 rounded text-black"
                    />
                    <button
                      onClick={() => handleArbiterProcessAppeal("submit")}
                      disabled={isUploading || !decisionFile}
                      className="w-full bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700 disabled:bg-purple-300"
                    >
                      Kararı Şifrele ve Sisteme İşle
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Öğretmen Kayıt */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-2 text-black">Öğretmen Kaydet</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cüzdan Adresi (0x...)"
                  className="flex-1 p-2 border rounded text-black"
                  value={teacherAddress}
                  onChange={(e) => setTeacherAddress(e.target.value)}
                />
                <button
                  onClick={handleRegisterTeacher}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Kaydet
                </button>
              </div>
            </div>

            {/* Öğrenci Kayıt */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-2 text-black">Öğrenci Kaydet</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cüzdan Adresi (0x...)"
                  className="flex-1 p-2 border rounded text-black"
                  value={studentAddress}
                  onChange={(e) => setStudentAddress(e.target.value)}
                />
                <button
                  onClick={handleRegisterStudent}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Kaydet
                </button>
              </div>
            </div>

            {/* Yeni Yönetici Oylama Süreci */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-3 flex justify-between items-center">
                <h3 className="font-semibold text-black">
                  Yeni Yönetici Oylaması
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  Güncel Oylama ID: {latestProposalId}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">1. Aday Teklif Et</p>
                <input
                  type="text"
                  placeholder="Cüzdan Adresi"
                  className="w-full p-2 border rounded text-black text-sm"
                  value={newAdminAddress}
                  onChange={(e) => setNewAdminAddress(e.target.value)}
                />
                <button
                  onClick={handleProposeAdmin}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Teklif Başlat
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">2. Oy Kullan</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Oylama ID"
                    className="w-1/2 p-2 border rounded text-black text-sm"
                    value={proposalId}
                    onChange={(e) => setProposalId(e.target.value)}
                  />
                  <select
                    className="w-1/2 p-2 border rounded text-black text-sm"
                    value={voteChoice}
                    onChange={(e) => setVoteChoice(e.target.value)}
                  >
                    <option value="1">Kabul (1)</option>
                    <option value="0">Ret (0)</option>
                  </select>
                </div>
                <button
                  onClick={handleVoteAdmin}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Oy Ver
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">3. Sonucu İşle</p>
                <input
                  type="number"
                  placeholder="Oylama ID"
                  className="w-full p-2 border rounded text-black text-sm"
                  value={execProposalId}
                  onChange={(e) => setExecProposalId(e.target.value)}
                />
                <button
                  onClick={handleExecuteAdmin}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
                >
                  Sonucu Onayla
                </button>
              </div>
            </div>

            {/* --- YÖNETİCİ HAKEM OYLAMA PANELİ (Sınav İptali) --- */}
            <div className="bg-red-50 p-6 rounded-lg border border-red-200 mt-6">
              <h3 className="text-xl font-bold text-red-900 border-b border-red-200 pb-2 mb-4">
                Yönetici Hakem Oylaması (Sınav İptali)
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Sınav Kontrat Adresi"
                  value={aCancelAssessment}
                  onChange={(e) => setACancelAssessment(e.target.value)}
                  className="w-full p-2 border border-red-300 rounded"
                />
                <input
                  type="text"
                  placeholder="İtiraz Eden Öğrenci Adresi"
                  value={aCancelStudent}
                  onChange={(e) => setACancelStudent(e.target.value)}
                  className="w-full p-2 border border-red-300 rounded"
                />
                <button
                  onClick={() => handleAdminCancelProcess("fetch")}
                  disabled={isUploading}
                  className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700"
                >
                  1. Öğretmen Raporunu Çöz ve Oku
                </button>
              </div>

              {fetchedTeacherReport && (
                <div className="mt-4 p-4 bg-white border border-red-300 rounded shadow-inner">
                  <a
                    href={fetchedTeacherReport.downloadUrl}
                    download="Ogretmen_Raporu.pdf"
                    className="bg-green-600 text-white px-4 py-1 rounded mb-4 inline-block font-bold"
                  >
                    Raporu İndir
                  </a>
                  <div className="mt-4 p-4 bg-gray-50 border rounded text-center">
                    <p className="font-bold mb-2">
                      Kararınız: Sınav İptal Edilsin mi?
                    </p>
                    <div className="flex gap-4 justify-center mt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-green-700">
                        <input
                          type="radio"
                          name="vote"
                          onChange={() => setCancelVote(true)}
                          className="w-5 h-5"
                        />{" "}
                        EVET (İptal Et)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-red-700">
                        <input
                          type="radio"
                          name="vote"
                          onChange={() => setCancelVote(false)}
                          defaultChecked
                          className="w-5 h-5"
                        />{" "}
                        HAYIR (Devam Et)
                      </label>
                    </div>
                    <button
                      onClick={() => handleAdminCancelProcess("vote")}
                      disabled={isUploading}
                      className="mt-4 w-full bg-black text-white py-2 rounded font-bold hover:bg-gray-800"
                    >
                      2. Oyumu Ağa Gönder
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* --- HAKEM YÖNETİCİ (Nota İtiraz Kararı) --- */}
            <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mt-6">
              <h3 className="text-xl font-bold text-yellow-900 border-b border-yellow-200 pb-2 mb-4">
                Hakem Yönetici Paneli (Nihai Not Kararı)
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Sınav Kontrat Adresi"
                  value={gaAAssessment}
                  onChange={(e) => setGaAAssessment(e.target.value)}
                  className="w-full p-2 border border-yellow-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Öğrenci Adresi"
                  value={gaAStudent}
                  onChange={(e) => setGaAStudent(e.target.value)}
                  className="w-full p-2 border border-yellow-300 rounded"
                />
                <button
                  onClick={() => handleGradeAppealAdminArbiter("fetch")}
                  disabled={isUploading}
                  className="w-full bg-yellow-600 text-white py-2 rounded font-bold"
                >
                  1. Öğretmen Raporunu Çöz
                </button>
              </div>
              {gaAFetchedReport && (
                <div className="mt-4 p-4 bg-white border border-yellow-300 rounded">
                  <a
                    href={gaAFetchedReport.url}
                    download="Hakem_Raporu.pdf"
                    className="bg-green-600 text-white px-4 py-1 rounded mb-4 inline-block font-bold"
                  >
                    Raporu İndir
                  </a>
                  <p className="text-sm font-bold mt-2">
                    Nihai Yeni Not Dosyasını Yükleyin:
                  </p>
                  <input
                    type="file"
                    onChange={(e) =>
                      setGaANewGradeFile(
                        e.target.files ? e.target.files[0] : null,
                      )
                    }
                    className="w-full p-2 border rounded my-2"
                  />
                  <button
                    onClick={() => handleGradeAppealAdminArbiter("submit")}
                    disabled={isUploading || !gaANewGradeFile}
                    className="w-full bg-black text-white py-2 rounded font-bold"
                  >
                    2. Yeni Notu Şifrele ve Süreci Bitir
                  </button>
                </div>
              )}
            </div>

            {/* GEÇİCİ BENCHMARK ALANI */}
          <div className="mt-8 p-4 bg-gray-800 text-white rounded-lg border-2 border-dashed border-gray-500">
            <h3 className="font-bold text-lg mb-2 text-blue-300">⚙️ Kriptografi Hız Testi (Benchmark)</h3>
            <p className="text-xs text-gray-400 mb-3">Sistemin saf AES-GCM şifreleme ve çözme hızını ölçer. Konsolu (F12) açarak sonuçları görün.</p>
            <input 
              type="file" 
              onChange={(e) => handleCryptoBenchmark(e.target.files ? e.target.files[0] : null)} 
              className="w-full p-2 bg-gray-700 rounded border border-gray-600"
            />
          </div>

          
          </div>
        )}

        {/* --- ÖĞRETMEN PANELİ --- */}
        {role === "Teacher" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-purple-800 border-b pb-2">
              Öğretmen Paneli - Sınav Oluştur ($Q$)
            </h2>

            {/* Öğretmen Açık Anahtar Kaydı */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg border border-purple-200 shadow-sm mb-6">
              <div>
                <h3 className="font-bold text-purple-900">
                  Güvenlik ve Şifreleme (Zorunlu)
                </h3>
                <p className="text-sm text-gray-600">
                  Öğrencilerin size şifreli cevap dosyası gönderebilmesi için
                  Public Key'inizi ağa kaydetmelisiniz.
                </p>
              </div>
              <button
                onClick={handleRegisterPublicKey}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 mt-2 sm:mt-0 font-semibold transition shadow"
              >
                🔑 Anahtarımı Ağa Duyur
              </button>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200 shadow-sm space-y-4">
              {/* Sınav Dosyası Yükleme */}
              <div>
                <label className="block text-sm font-semibold text-purple-900 mb-1">
                  Sınav Dosyası (PDF, Word vb.)
                </label>
                <input
                  type="file"
                  onChange={(e) =>
                    setExamFile(e.target.files ? e.target.files[0] : null)
                  }
                  className="w-full p-2 border border-purple-300 rounded bg-white text-black"
                />
                <p className="text-xs text-purple-600 mt-1">
                  Bu dosya IPFS'e yüklenmeden önce öğrencilerin açık anahtarları
                  (Public Key) ile şifrelenecektir.
                </p>
              </div>

              {/* Sınav Süresi */}
              <div>
                <label className="block text-sm font-semibold text-purple-900 mb-1">
                  Sınav Süresi (Dakika)
                </label>
                <input
                  type="number"
                  placeholder="Örn: 120"
                  value={examDuration}
                  onChange={(e) => setExamDuration(e.target.value)}
                  className="w-full p-2 border border-purple-300 rounded text-black"
                />
              </div>

              {/* Notlandırma Politikası */}
              <div>
                <label className="block text-sm font-semibold text-purple-900 mb-1">
                  Notlandırma Politikası
                </label>
                <input
                  type="text"
                  placeholder="Örn: Her soru 10 puan, yanlışlar doğruyu götürmez."
                  value={gradingPolicy}
                  onChange={(e) => setGradingPolicy(e.target.value)}
                  className="w-full p-2 border border-purple-300 rounded text-black"
                />
              </div>

              {/* Sınava Girecek Öğrenciler */}
              <div>
                <label className="block text-sm font-semibold text-purple-900 mb-1">
                  Sınava Girecek Öğrencilerin Cüzdan Adresleri
                </label>
                <textarea
                  placeholder="0xAdres1, 0xAdres2, 0xAdres3..."
                  value={examinees}
                  onChange={(e) => setExaminees(e.target.value)}
                  className="w-full p-2 border border-purple-300 rounded text-black h-24 resize-none"
                />
                <p className="text-xs text-purple-600 mt-1">
                  Birden fazla adres eklemek için aralarına virgül koyun.
                </p>
              </div>

              {/* Gönderme Butonu */}
              <button
                onClick={handleCreateAssessment}
                disabled={isUploading}
                className={`w-full py-3 rounded-lg text-lg font-bold text-white transition ${isUploading ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
              >
                {isUploading
                  ? "İşleniyor..."
                  : "Sınavı Şifrele ve IPFS'e Yükle"}
              </button>

              {/* YENİ EKLENEN: BAŞARILI SONUÇ EKRANI */}
              {assessmentResult && (
                <div className="mt-6 p-4 bg-green-50 border border-green-300 rounded-lg shadow-inner animate-fade-in">
                  <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                    ✅ Sınav Başarıyla Oluşturuldu!
                  </h3>
                  <p className="text-sm text-green-700 mb-4">
                    Lütfen aşağıdaki bilgileri güvenli bir yere kaydedin.
                    Sınavın takibi ve öğrencilerin erişimi için bu adresler
                    kullanılacaktır.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Sınav Akıllı Kontrat Adresi (K^Q)
                        </p>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              assessmentResult.contractAddress,
                              "Kontrat Adresi",
                            )
                          }
                          className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 text-gray-700 font-semibold transition"
                        >
                          📋 Kopyala
                        </button>
                      </div>
                      <p className="font-mono text-sm bg-white p-2 rounded border break-all text-black selection:bg-green-200">
                        {assessmentResult.contractAddress}
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          IPFS Bulut Adresi (CID)
                        </p>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              assessmentResult.ipfsCID,
                              "IPFS Adresi (CID)",
                            )
                          }
                          className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 text-gray-700 font-semibold transition"
                        >
                          📋 Kopyala
                        </button>
                      </div>
                      <p className="font-mono text-sm bg-white p-2 rounded border break-all text-black selection:bg-green-200">
                        {assessmentResult.ipfsCID}
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Orijinal Sınav Özeti H(Q)
                        </p>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              assessmentResult.fileHash,
                              "Sınav Özeti Hash'i",
                            )
                          }
                          className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 text-gray-700 font-semibold transition"
                        >
                          📋 Kopyala
                        </button>
                      </div>
                      <p className="font-mono text-sm bg-white p-2 rounded border break-all text-black selection:bg-green-200">
                        {assessmentResult.fileHash}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- ÖĞRETMEN DEĞERLENDİRME VE NOTLANDIRMA PANELİ --- */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm space-y-4 mt-8">
              <h2 className="text-xl font-bold text-blue-900 border-b border-blue-200 pb-2">
                Değerlendirme ve Notlandırma Paneli
              </h2>
              <p className="text-sm text-blue-700">
                Öğrencilerin gönderdiği cevapları inceleyin ve notlandırın.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Sınav Akıllı Kontrat Adresi (K^Q)"
                  value={evalAssessmentAddress}
                  onChange={(e) => setEvalAssessmentAddress(e.target.value)}
                  className="w-full p-2 border border-blue-300 rounded text-black"
                />
                <input
                  type="text"
                  placeholder="Değerlendirilecek Öğrencinin Cüzdan Adresi"
                  value={evalStudentAddress}
                  onChange={(e) => setEvalStudentAddress(e.target.value)}
                  className="w-full p-2 border border-blue-300 rounded text-black"
                />
                <button
                  onClick={handleFetchAndDecryptAnswer}
                  disabled={
                    isUploading || !evalAssessmentAddress || !evalStudentAddress
                  }
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isUploading
                    ? "İşleniyor..."
                    : "Öğrenci Cevabını Getir ve Şifresini Çöz"}
                </button>
              </div>

              {/* Öğrenci Cevabı Bulunduğunda Açılan Notlandırma Alanı */}
              {fetchedAnswerDetails && (
                <div className="mt-4 p-4 bg-white border border-blue-300 rounded-lg shadow-inner animate-fade-in space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-blue-800">
                      Cevap Dosyası Hazır
                    </h3>
                    <a
                      href={fetchedAnswerDetails.downloadUrl}
                      download={`Cevap_${fetchedAnswerDetails.student.substring(0, 6)}.pdf`}
                      className="bg-green-600 text-white px-4 py-1 rounded shadow hover:bg-green-700 text-sm font-bold"
                    >
                      Cevabı İndir (PDF)
                    </a>
                  </div>

                  <div className="pt-2">
                    <h3 className="font-bold text-purple-900 mb-2">
                      Not Dosyası Yükle ($G$)
                    </h3>
                    <p className="text-xs text-gray-600 mb-2">
                      Not dosyası, doğrudan öğrencinin (
                      {fetchedAnswerDetails.student.substring(0, 6)}...) açık
                      anahtarıyla şifrelenecektir.
                    </p>
                    <input
                      type="file"
                      onChange={(e) =>
                        setGradeFile(e.target.files ? e.target.files[0] : null)
                      }
                      className="w-full p-2 border border-purple-300 rounded text-black mb-3"
                    />
                    <button
                      onClick={handleSubmitGrade}
                      disabled={isGradeSubmitting || !gradeFile}
                      className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-300 transition"
                    >
                      {isGradeSubmitting
                        ? "Şifrelenip Yükleniyor..."
                        : "Notu Şifrele ve Sisteme İşle"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sınav Kapanış (Finalize) Alanı */}
              <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-bold text-red-900 mb-2">
                  Sınavı Kapat (Closure Message)
                </h3>
                <p className="text-xs text-red-700 mb-2">
                  Tüm notlandırmalar bittikten sonra, cevap anahtarını ($W$)
                  yükleyerek sınavı kapatın. (Bu işlem geri alınamaz).
                </p>
                <input
                  type="file"
                  onChange={(e) =>
                    setAnswerSheetFile(
                      e.target.files ? e.target.files[0] : null,
                    )
                  }
                  className="w-full p-2 border border-red-300 rounded text-black mb-2 text-sm"
                />
                <button
                  onClick={handleFinalizeAssessment}
                  disabled={
                    isUploading || !evalAssessmentAddress || !answerSheetFile
                  }
                  className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-red-300"
                >
                  {isUploading ? "İşleniyor..." : "Sınavı Kalıcı Olarak Kapat"}
                </button>
              </div>

              {/* --- ÖĞRETMEN HAKEM (Sınav İptali İnceleme) --- */}
              <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 mt-8">
                <h3 className="text-xl font-bold text-orange-900 border-b border-orange-200 pb-2 mb-4">
                  Öğretmen Hakem Paneli (Sınav İptal Süreci)
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Sınav Kontrat Adresi"
                    value={tCancelAssessment}
                    onChange={(e) => setTCancelAssessment(e.target.value)}
                    className="w-full p-2 border border-orange-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="İtiraz Eden Öğrenci Adresi"
                    value={tCancelStudent}
                    onChange={(e) => setTCancelStudent(e.target.value)}
                    className="w-full p-2 border border-orange-300 rounded"
                  />
                  <button
                    onClick={() => handleTeacherCancelProcess("fetch")}
                    disabled={isUploading}
                    className="w-full bg-orange-600 text-white py-2 rounded font-bold hover:bg-orange-700"
                  >
                    1. Öğrencinin İptal Dilekçesini Çöz
                  </button>
                </div>

                {fetchedCancelAppeal && (
                  <div className="mt-4 p-4 bg-white border border-orange-300 rounded shadow-inner">
                    <a
                      href={fetchedCancelAppeal.downloadUrl}
                      download="Iptal_Dilekcesi.pdf"
                      className="bg-green-600 text-white px-4 py-1 rounded mb-4 inline-block font-bold"
                    >
                      Dilekçeyi İndir
                    </a>
                    <p className="text-sm font-bold mt-2">
                      İnceleme Raporunuzu Yükleyin (3 Yönetici Hakem için
                      şifrelenecek):
                    </p>
                    <input
                      type="file"
                      onChange={(e) =>
                        setTeacherReportFile(
                          e.target.files ? e.target.files[0] : null,
                        )
                      }
                      className="w-full p-2 border border-orange-300 rounded my-2"
                    />
                    <button
                      onClick={() => handleTeacherCancelProcess("submit")}
                      disabled={isUploading || !teacherReportFile}
                      className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700"
                    >
                      2. Raporu Şifrele ve Yöneticilere Sun
                    </button>
                  </div>
                )}
              </div>

              {/* --- ASIL ÖĞRETMEN (Cevap Anahtarı Sunma) --- */}
              <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mt-8">
                <h3 className="text-xl font-bold text-yellow-900 border-b border-yellow-200 pb-2 mb-4">
                  Asıl Öğretmen (Nota İtiraz: Anahtar Sunumu)
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  Nota itiraz eden öğrencinin atanmış Hakem Öğretmenine cevap
                  anahtarını şifreleyip gönderin.
                </p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Sınav Kontrat Adresi"
                    value={gaExAssessment}
                    onChange={(e) => setGaExAssessment(e.target.value)}
                    className="w-full p-2 border border-yellow-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Öğrenci Adresi"
                    value={gaExStudent}
                    onChange={(e) => setGaExStudent(e.target.value)}
                    className="w-full p-2 border border-yellow-300 rounded"
                  />
                  <input
                    type="file"
                    onChange={(e) =>
                      setGaExAnswerKeyFile(
                        e.target.files ? e.target.files[0] : null,
                      )
                    }
                    className="w-full p-2 border border-yellow-300 rounded"
                  />
                  <button
                    onClick={handleGradeAppealExaminer}
                    disabled={isUploading || !gaExAnswerKeyFile}
                    className="w-full bg-yellow-600 text-white py-2 rounded font-bold hover:bg-yellow-700"
                  >
                    Cevap Anahtarını Gönder
                  </button>
                </div>
              </div>

              {/* --- HAKEM ÖĞRETMEN (Nota İtiraz İncelemesi) --- */}
              <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 mt-4">
                <h3 className="text-xl font-bold text-orange-900 border-b border-orange-200 pb-2 mb-4">
                  Hakem Öğretmen Paneli (Nota İtiraz)
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Sınav Kontrat Adresi"
                    value={gaTAssessment}
                    onChange={(e) => setGaTAssessment(e.target.value)}
                    className="w-full p-2 border border-orange-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Öğrenci Adresi"
                    value={gaTStudent}
                    onChange={(e) => setGaTStudent(e.target.value)}
                    className="w-full p-2 border border-orange-300 rounded"
                  />
                  <button
                    onClick={() => handleGradeAppealTeacherArbiter("fetch")}
                    disabled={isUploading}
                    className="w-full bg-orange-600 text-white py-2 rounded font-bold"
                  >
                    1. Dilekçe ve Anahtarı Çöz
                  </button>
                </div>
                {gaTFetchedData && (
                  <div className="mt-4 p-4 bg-white border border-orange-300 rounded">
                    <div className="flex gap-2 mb-4">
                      <a
                        href={gaTFetchedData.appealUrl}
                        download="Dilekce.pdf"
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold w-1/2 text-center"
                      >
                        Dilekçeyi İndir
                      </a>
                      <a
                        href={gaTFetchedData.keyUrl}
                        download="Anahtar.pdf"
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold w-1/2 text-center"
                      >
                        Anahtarı İndir
                      </a>
                    </div>
                    <p className="text-sm font-bold">
                      Karar Raporunuzu Yükleyin (Yönetici için şifrelenecek):
                    </p>
                    <input
                      type="file"
                      onChange={(e) =>
                        setGaTReportFile(
                          e.target.files ? e.target.files[0] : null,
                        )
                      }
                      className="w-full p-2 border rounded my-2"
                    />
                    <button
                      onClick={() => handleGradeAppealTeacherArbiter("submit")}
                      disabled={isUploading || !gaTReportFile}
                      className="w-full bg-red-600 text-white py-2 rounded font-bold"
                    >
                      2. Raporu Yöneticiye Sun
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- ÖĞRENCİ PANELİ --- */}
        {role === "Student" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-orange-800 border-b pb-2">
              Öğrenci Paneli - Sınav İşlemleri
            </h2>

            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 shadow-sm space-y-6">
              {/* Açık Anahtar Kaydı (Eski bölümü koruyoruz) */}
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded border border-orange-100">
                <div>
                  <h3 className="font-bold text-orange-900">
                    Güvenlik ve Şifreleme
                  </h3>
                  <p className="text-sm text-gray-600">
                    Sınavları alabilmeniz için Public Key'iniz ağda olmalıdır.
                  </p>
                </div>
                <button
                  onClick={handleRegisterPublicKey}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 mt-2 sm:mt-0"
                >
                  Anahtarımı Ağa Duyur
                </button>
              </div>

              {/* 1. Aşama: Sınavı Getir ve Çöz */}
              <div className="space-y-3">
                <h3 className="font-bold text-orange-900">
                  1. Sınavı İndir ve Şifresini Çöz ($Q$)
                </h3>
                <input
                  type="text"
                  placeholder="Sınav Akıllı Kontrat Adresi (K^Q)"
                  value={targetAssessmentAddress}
                  onChange={(e) => setTargetAssessmentAddress(e.target.value)}
                  className="w-full p-2 border border-orange-300 rounded text-black"
                />
                <button
                  onClick={handleFetchAndDecryptExam}
                  disabled={isUploading || !targetAssessmentAddress}
                  className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-orange-300"
                >
                  {isUploading
                    ? "İşleniyor..."
                    : "Sınavı Getir, Hash'i Doğrula ve Şifreyi Çöz"}
                </button>
              </div>

              {/* 2. Aşama: Sınav Dosyası ve Cevap Yükleme */}
              {fetchedExamDetails && (
                <div className="mt-6 p-4 bg-white border border-green-300 rounded-lg shadow-inner animate-fade-in space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-green-800">
                      ✅ Sınav Dosyası Hazır
                    </h3>
                    <a
                      href={fetchedExamDetails.downloadUrl}
                      download="Sinav_Sorulari.pdf"
                      className="bg-green-600 text-white px-4 py-1 rounded shadow hover:bg-green-700 text-sm font-bold"
                    >
                      PDF'i İndir
                    </a>
                  </div>

                  {/* YENİ EKLENEN: METADATA BİLGİ KUTUSU */}
                  <div className="bg-green-50 p-3 rounded border border-green-100 text-sm text-green-900 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <p>
                      <span className="font-bold text-green-700">
                        ⏳ Sınav Süresi:
                      </span>{" "}
                      {fetchedExamDetails.duration} Dakika
                    </p>
                    <p>
                      <span className="font-bold text-green-700">
                        📜 Not Politikası:
                      </span>{" "}
                      {fetchedExamDetails.policy}
                    </p>
                    <div className="col-span-1 sm:col-span-2 flex justify-between items-center bg-white p-2 rounded border border-green-200 mt-1">
                      <p className="truncate mr-2">
                        <span className="font-bold text-green-700">
                          👨‍🏫 Sorumlu Öğretmen:
                        </span>{" "}
                        <span className="font-mono">
                          {fetchedExamDetails.examiner}
                        </span>
                      </p>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            fetchedExamDetails.examiner,
                            "Öğretmen Adresi",
                          )
                        }
                        className="text-xs bg-green-100 border border-green-300 px-2 py-1 rounded hover:bg-green-200 text-green-800 font-semibold transition shrink-0"
                      >
                        📋 Kopyala
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="font-bold text-orange-900 mb-2">
                      2. Cevaplarınızı Yükleyin ($A$)
                    </h3>
                    <p className="text-xs text-gray-600 mb-2">
                      Cevap dosyanız, yüklenmeden önce otomatik olarak
                      Öğretmenin ({fetchedExamDetails.examiner.substring(0, 6)}
                      ...) açık anahtarıyla şifrelenecektir.
                    </p>
                    <input
                      type="file"
                      onChange={(e) =>
                        setAnswerFile(e.target.files ? e.target.files[0] : null)
                      }
                      className="w-full p-2 border border-orange-300 rounded text-black mb-3"
                    />
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={isAnswerSubmitting || !answerFile}
                      className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-blue-300 transition"
                    >
                      {isAnswerSubmitting
                        ? "Şifrelenip Yükleniyor..."
                        : "Cevapları Şifrele ve Teslim Et"}
                    </button>
                  </div>

                  {/* 3. Aşama: Notları Getir */}
                  <div className="pt-6 border-t border-green-200 mt-6">
                    <h3 className="font-bold text-green-900 mb-2">
                      3. Sınav Sonucunuzu Görün ($G$)
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Öğretmeniniz notunuzu okuyup sisteme girdiyse, buradan
                      kendi cüzdanınızla şifresini çözerek indirebilirsiniz.
                    </p>
                    <button
                      onClick={handleFetchAndDecryptGrade}
                      disabled={isUploading}
                      className="w-full bg-green-700 text-white px-4 py-3 rounded-lg hover:bg-green-800 disabled:bg-green-400 transition font-bold shadow"
                    >
                      {isUploading
                        ? "İşleniyor..."
                        : "Notumu Getir ve Şifresini Çöz"}
                    </button>

                    {fetchedGradeDetails && (
                      <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded text-center animate-fade-in">
                        <p className="text-green-900 font-bold mb-3">
                          🎉 Not Dosyanız Hazır!
                        </p>
                        <a
                          href={fetchedGradeDetails.downloadUrl}
                          download="Sinav_Notu.pdf"
                          className="inline-block bg-white border border-green-500 text-green-700 px-6 py-2 rounded-full shadow hover:bg-green-50 text-sm font-bold transition"
                        >
                          📄 Not Belgesini İndir
                        </a>
                      </div>
                    )}
                  </div>
                  {/* --- İTİRAZ SÜRECİ (APPEAL) --- */}
                  <div className="pt-6 border-t border-red-200 mt-6 bg-red-50 p-4 rounded-lg">
                    <h3 className="font-bold text-red-900 mb-2">
                      4. Sınava İtiraz Et (Appeal to Retake)
                    </h3>
                    <p className="text-xs text-red-700 mb-3">
                      Sınava geçerli bir mazeretle katılamadıysanız rastgele bir
                      hakem atanmasını talep edebilirsiniz.
                    </p>

                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Sınav Akıllı Kontrat Adresi (K^Q)"
                        value={appealTargetAddress}
                        onChange={(e) => setAppealTargetAddress(e.target.value)}
                        className="w-full p-2 border border-red-300 rounded text-black text-sm"
                      />

                      {!appealStatus ? (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCheckOrRequestArbiter(true)}
                              disabled={isUploading}
                              className="w-1/2 bg-red-600 text-white px-2 py-2 rounded hover:bg-red-700 text-sm font-bold"
                            >
                              1. Rastgele Hakem İste
                            </button>
                            <button
                              onClick={() => handleCheckOrRequestArbiter(false)}
                              disabled={isUploading}
                              className="w-1/2 bg-gray-600 text-white px-2 py-2 rounded hover:bg-gray-700 text-sm font-bold"
                            >
                              Durumu Kontrol Et
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white p-3 border border-red-200 rounded text-sm text-black">
                          <p className="mb-2">
                            <span className="font-bold">Atanan Hakem:</span>{" "}
                            <span className="font-mono text-xs">
                              {appealStatus.arbiter}
                            </span>
                          </p>

                          {!appealStatus.appealCID ? (
                            <div className="space-y-2 mt-4 border-t pt-2">
                              <p className="text-xs text-gray-600">
                                Dilekçeniz (
                                {appealStatus.arbiter.substring(0, 6)}...)
                                hakemine özel şifrelenecektir.
                              </p>
                              <input
                                type="file"
                                onChange={(e) =>
                                  setAppealFile(
                                    e.target.files ? e.target.files[0] : null,
                                  )
                                }
                                className="w-full p-2 border border-red-300 rounded"
                              />
                              <button
                                onClick={handleSubmitRetakeAppeal}
                                disabled={isUploading || !appealFile}
                                className="w-full bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700 font-bold"
                              >
                                2. Dilekçeyi Şifrele ve Yükle
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 text-green-700 font-bold">
                              ✅ Dilekçe Hakeme İletildi.
                            </div>
                          )}

                          {appealStatus.isResolved && (
                            <div
                              className={`mt-3 p-2 rounded text-center text-white font-bold ${appealStatus.isAccepted ? "bg-green-600" : "bg-red-600"}`}
                            >
                              KARAR:{" "}
                              {appealStatus.isAccepted
                                ? "KABUL EDİLDİ (Tekrar Girebilirsiniz)"
                                : "REDDEDİLDİ"}
                              <p className="text-xs font-normal mt-1">
                                Karar dosyası şifreli olarak IPFS'te:{" "}
                                {appealStatus.decisionCID}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* --- SINAV İPTAL BAŞVURUSU --- */}
                  <div className="pt-6 border-t border-purple-200 mt-6 bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-bold text-purple-900 mb-2">
                      5. Sınavın İptalini Talep Et (Appeal to Cancel)
                    </h3>
                    <p className="text-xs text-purple-700 mb-3">
                      Sınavda ciddi hatalar tespit ettiyseniz, 4 kişilik bir
                      hakem heyetinin (1 Öğretmen, 3 Yönetici) toplanmasını ve
                      sınavın iptalini talep edebilirsiniz.
                    </p>

                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Sınav Kontrat Adresi"
                        value={cancelTargetAddress}
                        onChange={(e) => setCancelTargetAddress(e.target.value)}
                        className="w-full p-2 border border-purple-300 rounded"
                      />

                      {!cancelStatus ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleCheckOrRequestCancelArbiters(true)
                            }
                            disabled={isUploading}
                            className="w-1/2 bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-700 text-sm"
                          >
                            1. Heyet Topla
                          </button>
                          <button
                            onClick={() =>
                              handleCheckOrRequestCancelArbiters(false)
                            }
                            disabled={isUploading}
                            className="w-1/2 bg-gray-600 text-white py-2 rounded font-bold hover:bg-gray-700 text-sm"
                          >
                            Durumu Kontrol Et
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white p-3 border border-purple-200 rounded text-sm text-black">
                          <p className="font-bold mb-1">Atanan Hakem Heyeti:</p>
                          <ul className="text-xs font-mono mb-3 bg-gray-50 p-2 rounded">
                            <li>
                              👨‍🏫 T:{" "}
                              {cancelStatus.teacherArbiter.substring(0, 8)}...
                            </li>
                            <li>
                              👨‍💼 A1:{" "}
                              {cancelStatus.adminArbiter1.substring(0, 8)}...
                            </li>
                            <li>
                              👨‍💼 A2:{" "}
                              {cancelStatus.adminArbiter2.substring(0, 8)}...
                            </li>
                            <li>
                              👨‍💼 A3:{" "}
                              {cancelStatus.adminArbiter3.substring(0, 8)}...
                            </li>
                          </ul>

                          {!cancelStatus.appealCID ? (
                            <div className="space-y-2 mt-2 border-t pt-2">
                              <p className="text-xs text-gray-600">
                                İptal gerekçenizi/kanıtlarınızı içeren dilekçeyi
                                yükleyin (4 hakeme özel şifrelenecek):
                              </p>
                              <input
                                type="file"
                                onChange={(e) =>
                                  setCancelAppealFile(
                                    e.target.files ? e.target.files[0] : null,
                                  )
                                }
                                className="w-full p-2 border border-purple-300 rounded"
                              />
                              <button
                                onClick={handleSubmitCancelAppeal}
                                disabled={isUploading || !cancelAppealFile}
                                className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700"
                              >
                                2. Dilekçeyi Şifrele ve Yükle
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 text-green-700 font-bold border-t pt-2">
                              ✅ Dilekçe 4 Hakeme İletildi. <br />
                              <span className="text-xs font-normal text-gray-600">
                                Oylama Durumu: {cancelStatus.yesVotes} EVET /{" "}
                                {cancelStatus.noVotes} HAYIR (Gereken: 2 EVET)
                              </span>
                            </div>
                          )}

                          {cancelStatus.isResolved && (
                            <div
                              className={`mt-3 p-2 rounded text-center text-white font-bold ${cancelStatus.yesVotes >= 2 ? "bg-green-600" : "bg-red-600"}`}
                            >
                              SONUÇ:{" "}
                              {cancelStatus.yesVotes >= 2
                                ? "SINAV İPTAL EDİLDİ!"
                                : "İPTAL TALEBİ REDDEDİLDİ."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* --- NOTA İTİRAZ SÜRECİ --- */}
                  <div className="pt-6 border-t border-yellow-200 mt-6 bg-yellow-50 p-4 rounded-lg">
                    <h3 className="font-bold text-yellow-900 mb-2">
                      6. Nota İtiraz Et (Appeal a Grade)
                    </h3>
                    <p className="text-xs text-yellow-700 mb-3">
                      Aldığınız notun haksız olduğunu düşünüyorsanız, bir Hakem
                      Öğretmen ve bir Hakem Yönetici atanmasını talep
                      edebilirsiniz.
                    </p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Sınav Kontrat Adresi"
                        value={gaTargetAddress}
                        onChange={(e) => setGaTargetAddress(e.target.value)}
                        className="w-full p-2 border border-yellow-300 rounded"
                      />
                      {!gaStatus ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGradeAppealStudent("request")}
                            disabled={isUploading}
                            className="w-1/2 bg-yellow-600 text-white py-2 rounded font-bold hover:bg-yellow-700 text-sm"
                          >
                            1. Hakem İste
                          </button>
                          <button
                            onClick={() => handleGradeAppealStudent("check")}
                            disabled={isUploading}
                            className="w-1/2 bg-gray-600 text-white py-2 rounded font-bold hover:bg-gray-700 text-sm"
                          >
                            Durumu Kontrol Et
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white p-3 border border-yellow-200 rounded text-sm text-black">
                          <p className="font-bold">Atanan Hakemler:</p>
                          <ul className="text-xs font-mono mb-2">
                            <li>
                              👨‍🏫 Öğretmen (T_j):{" "}
                              {gaStatus.tArbiter.substring(0, 8)}...
                            </li>
                            <li>
                              👨‍💼 Yönetici (O_j):{" "}
                              {gaStatus.aArbiter.substring(0, 8)}...
                            </li>
                          </ul>
                          {!gaStatus.appealCID ? (
                            <div className="mt-2 border-t pt-2">
                              <p className="text-xs mb-1">
                                Dilekçenizi Yükleyin:
                              </p>
                              <input
                                type="file"
                                onChange={(e) =>
                                  setGaAppealFile(
                                    e.target.files ? e.target.files[0] : null,
                                  )
                                }
                                className="w-full p-1 border rounded mb-2"
                              />
                              <button
                                onClick={() =>
                                  handleGradeAppealStudent("submit")
                                }
                                disabled={isUploading || !gaAppealFile}
                                className="w-full bg-blue-600 text-white py-1 rounded font-bold"
                              >
                                2. Dilekçeyi Gönder
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 text-green-700 font-bold">
                              ✅ Dilekçe İletildi. Durum:{" "}
                              {gaStatus.isResolved
                                ? "SONUÇLANDI (Yeni notunuzu 3. aşamadan indirebilirsiniz)"
                                : "İnceleniyor..."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {role === "Unregistered" && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <h2 className="text-xl font-bold text-red-800 mb-2">
              Yetkisiz Erişim
            </h2>
            <p className="text-red-700">
              Sistemde herhangi bir rolünüz bulunmamaktadır. Lütfen sisteme
              kayıt olmak için bir Yönetici ile iletişime geçin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
