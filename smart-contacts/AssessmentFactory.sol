// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRoleRegistration {
    function isAdministrator(address _user) external view returns (bool);
    function isTeacher(address _user) external view returns (bool);
    function isStudent(address _user) external view returns (bool);
    function adminCount() external view returns (uint256);
    function adminById(uint256 _id) external view returns (address);
    function teacherCount() external view returns (uint256);
    function teacherById(uint256 _id) external view returns (address);
}

contract Assessment {
    IRoleRegistration public roleContract;
    
    address public examiner;
    string public fileHash;    
    string public ipfsCID;     
    uint256 public duration;
    string public policy;
    address[] public examinees;
    uint256 public timestamp;
    
    bool public isClosed; 
    bool public isCanceled; 

    mapping(address => bool) public isExaminee;

    struct Answer { string answerHash; string ipfsCID; uint256 timestamp; }
    struct Grade { string gradeHash; string ipfsCID; uint256 timestamp; }
    
    struct RetakeAppeal {
        address arbiter;        
        string appealHash;      
        string appealCID;       
        bool isResolved;        
        bool isAccepted;        
        string decisionHash;    
        string decisionCID;     
    }

    struct CancelAppeal {
        address teacherArbiter;   
        address adminArbiter1;    
        address adminArbiter2;    
        address adminArbiter3;    
        string appealHash;        
        string appealCID;         
        string teacherDecisionHash; 
        string teacherDecisionCID;
        bool teacherReported;     
        uint8 yesVotes;           
        uint8 noVotes;            
        bool isResolved;          
    }

    struct GradeAppeal {
        address tArbiter;         // T_j (Hakem Öğretmen)
        address aArbiter;         // O_j (Hakem Yönetici)
        string appealHash;        // H(L)
        string appealCID;         // Enc(L, T_j) & Enc(L, O_j)
        string answerKeyHash;     // H(W) (Asıl Öğretmenin sunduğu anahtar)
        string answerKeyCID;      // Enc(W, T_j)
        bool keyProvided;         // Asıl öğretmen anahtarı sundu mu?
        string tReportHash;       // H(B_L) (Hakem öğretmenin raporu)
        string tReportCID;        // Enc(B_L, O_j)
        bool tReported;           // Hakem öğretmen raporu sundu mu?
        bool isResolved;          // Süreç bitti mi?
    }
    
    mapping(address => Answer) public studentAnswers;
    mapping(address => bool) public hasSubmitted;
    mapping(address => Grade) public studentGrades;
    mapping(address => bool) public isGraded;

    mapping(address => RetakeAppeal) public retakeAppeals;
    mapping(address => bool) public hasRequestedRetake;

    mapping(address => CancelAppeal) public cancelAppeals;
    mapping(address => bool) public hasRequestedCancel;
    mapping(address => mapping(address => bool)) public hasVotedCancel; 

    // Nota itiraz veritabanı
    mapping(address => GradeAppeal) public gradeAppeals;
    mapping(address => bool) public hasRequestedGradeAppeal;

    event AssessmentStarted(address indexed examiner, string fileHash, string ipfsCID, uint256 timestamp);
    event AnswerSubmitted(address indexed examinee, string answerHash, string ipfsCID, uint256 timestamp);
    event GradeSubmitted(address indexed examinee, string gradeHash, string ipfsCID, uint256 timestamp);
    event AssessmentClosed(address indexed examiner, string fileHash, string answerSheetHash, uint256 timestamp);
    event AssessmentCanceledAlert(address indexed examinee);

    event ArbiterAssigned(address indexed examinee, address indexed arbiter);
    event RetakeAppealSubmitted(address indexed examinee, address indexed arbiter, string appealHash, string appealCID);
    event RetakeDecisionSubmitted(address indexed examinee, address indexed arbiter, bool isAccepted, string decisionHash, string decisionCID);

    event CancelArbitersAssigned(address indexed examinee, address teacher, address admin1, address admin2, address admin3);
    event CancelAppealSubmitted(address indexed examinee, string appealHash, string appealCID);
    event TeacherCancelReportSubmitted(address indexed examinee, address indexed teacher, string decisionHash, string decisionCID);
    event CancelVoteCast(address indexed examinee, address indexed admin, bool voteDecision);

    // Nota İtiraz (Grade Appeal) Eventleri
    event GradeArbitersAssigned(address indexed examinee, address tArbiter, address aArbiter);
    event GradeAppealSubmitted(address indexed examinee, string appealHash, string appealCID);
    event AnswerKeyProvidedForArbiter(address indexed examinee, address indexed examiner);
    event TeacherGradeReportSubmitted(address indexed examinee, address indexed tArbiter);
    event GradeAppealResolved(address indexed examinee, address indexed aArbiter, string newGradeHash, string newGradeCID);

    modifier onlyExaminer() { require(msg.sender == examiner, "Sadece sinav sahibi."); _; }
    modifier assessmentNotCanceled() { require(!isCanceled, "Sinav iptal."); _; }

    constructor(address _roleContractAddress, address _examiner, string memory _fileHash, string memory _ipfsCID, uint256 _duration, string memory _policy, address[] memory _examinees) {
        roleContract = IRoleRegistration(_roleContractAddress);
        examiner = _examiner;
        bool isValid = true;
        for (uint i = 0; i < _examinees.length; i++) {
            if (!roleContract.isStudent(_examinees[i])) { isValid = false; break; }
            isExaminee[_examinees[i]] = true;
        }
        require(isValid, "Gecersiz ogrenci.");
        fileHash = _fileHash;
        ipfsCID = _ipfsCID;
        duration = _duration;
        policy = _policy;
        examinees = _examinees;
        timestamp = block.timestamp;
        emit AssessmentStarted(_examiner, _fileHash, _ipfsCID, block.timestamp);
    }

    function submitAnswer(string memory _answerHash, string memory _answerCID) public assessmentNotCanceled {
        require(!isClosed, "Sinav kapali.");
        require(isExaminee[msg.sender], "Yetkisiz.");
        require(!hasSubmitted[msg.sender], "Zaten yuklendi.");
        studentAnswers[msg.sender] = Answer({answerHash: _answerHash, ipfsCID: _answerCID, timestamp: block.timestamp});
        hasSubmitted[msg.sender] = true;
        emit AnswerSubmitted(msg.sender, _answerHash, _answerCID, block.timestamp);
    }

    function submitGrade(address _examinee, string memory _gradeHash, string memory _gradeCID) public onlyExaminer assessmentNotCanceled {
        require(!isClosed, "Sinav kapali.");
        require(hasSubmitted[_examinee], "Cevap yok.");
        require(!isGraded[_examinee], "Not girildi.");
        studentGrades[_examinee] = Grade({gradeHash: _gradeHash, ipfsCID: _gradeCID, timestamp: block.timestamp});
        isGraded[_examinee] = true;
        emit GradeSubmitted(_examinee, _gradeHash, _gradeCID, block.timestamp);
    }

    function finalizeAssessment(string memory _answerSheetHash) public onlyExaminer assessmentNotCanceled {
        require(!isClosed, "Zaten kapali.");
        isClosed = true;
        emit AssessmentClosed(msg.sender, fileHash, _answerSheetHash, block.timestamp);
    }

    // --- MEVCUT RETAKE VE CANCEL FONKSİYONLARI ---
    function requestRetakeArbiter() public assessmentNotCanceled {
        require(isExaminee[msg.sender], "Yetkisiz.");
        require(!hasRequestedRetake[msg.sender], "Talep var.");
        uint256 tAdmins = roleContract.adminCount();
        require(tAdmins > 0, "Admin yok.");

        uint256 rand = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, msg.sender)));
        address arbiter = roleContract.adminById((rand % tAdmins) + 1);
        
        retakeAppeals[msg.sender].arbiter = arbiter;
        hasRequestedRetake[msg.sender] = true;
        emit ArbiterAssigned(msg.sender, arbiter);
    }

    function submitRetakeAppeal(string memory _appealHash, string memory _appealCID) public assessmentNotCanceled {
        require(hasRequestedRetake[msg.sender], "Talep yok.");
        require(!retakeAppeals[msg.sender].isResolved, "Cozuldu.");
        retakeAppeals[msg.sender].appealHash = _appealHash;
        retakeAppeals[msg.sender].appealCID = _appealCID;
        emit RetakeAppealSubmitted(msg.sender, retakeAppeals[msg.sender].arbiter, _appealHash, _appealCID);
    }

    function submitRetakeDecision(address _examinee, bool _isAccepted, string memory _decisionHash, string memory _decisionCID) public {
        require(retakeAppeals[_examinee].arbiter == msg.sender, "Yetkisiz hakem.");
        require(!retakeAppeals[_examinee].isResolved, "Cozulmus.");
        retakeAppeals[_examinee].isResolved = true;
        retakeAppeals[_examinee].isAccepted = _isAccepted;
        retakeAppeals[_examinee].decisionHash = _decisionHash;
        retakeAppeals[_examinee].decisionCID = _decisionCID;
        emit RetakeDecisionSubmitted(_examinee, msg.sender, _isAccepted, _decisionHash, _decisionCID);
    }

    function requestCancelArbiters() public assessmentNotCanceled {
        require(isExaminee[msg.sender], "Yetkisiz.");
        require(!hasRequestedCancel[msg.sender], "Talep var.");

        uint256 tCount = roleContract.teacherCount();
        uint256 aCount = roleContract.adminCount();
        require(tCount >= 1 && aCount >= 3, "Yetersiz personel.");

        uint256 rand = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, msg.sender)));
        
        address tArbiter = roleContract.teacherById((rand % tCount) + 1);
        uint256 a1 = (uint256(keccak256(abi.encodePacked(rand, uint256(1)))) % aCount) + 1;
        uint256 a2 = (uint256(keccak256(abi.encodePacked(rand, uint256(2)))) % aCount) + 1;
        while(a2 == a1) { a2 = (a2 % aCount) + 1; } 
        uint256 a3 = (uint256(keccak256(abi.encodePacked(rand, uint256(3)))) % aCount) + 1;
        while(a3 == a1 || a3 == a2) { a3 = (a3 % aCount) + 1; } 

        cancelAppeals[msg.sender].teacherArbiter = tArbiter;
        cancelAppeals[msg.sender].adminArbiter1 = roleContract.adminById(a1);
        cancelAppeals[msg.sender].adminArbiter2 = roleContract.adminById(a2);
        cancelAppeals[msg.sender].adminArbiter3 = roleContract.adminById(a3);
        hasRequestedCancel[msg.sender] = true;

        emit CancelArbitersAssigned(msg.sender, tArbiter, roleContract.adminById(a1), roleContract.adminById(a2), roleContract.adminById(a3));
    }

    function submitCancelAppeal(string memory _appealHash, string memory _appealCID) public assessmentNotCanceled {
        require(hasRequestedCancel[msg.sender], "Talep yok.");
        require(!cancelAppeals[msg.sender].isResolved, "Cozuldu.");
        cancelAppeals[msg.sender].appealHash = _appealHash;
        cancelAppeals[msg.sender].appealCID = _appealCID;
        emit CancelAppealSubmitted(msg.sender, _appealHash, _appealCID);
    }

    function submitTeacherCancelDecision(address _examinee, string memory _decisionHash, string memory _decisionCID) public {
        require(cancelAppeals[_examinee].teacherArbiter == msg.sender, "Yetkisiz.");
        require(!cancelAppeals[_examinee].teacherReported, "Rapor var.");
        cancelAppeals[_examinee].teacherDecisionHash = _decisionHash;
        cancelAppeals[_examinee].teacherDecisionCID = _decisionCID;
        cancelAppeals[_examinee].teacherReported = true;
        emit TeacherCancelReportSubmitted(_examinee, msg.sender, _decisionHash, _decisionCID);
    }

    function voteCancel(address _examinee, bool _voteDecision) public {
        CancelAppeal storage appeal = cancelAppeals[_examinee];
        require(!appeal.isResolved, "Cozuldu.");
        require(appeal.teacherReported, "Rapor bekleniyor.");
        require(msg.sender == appeal.adminArbiter1 || msg.sender == appeal.adminArbiter2 || msg.sender == appeal.adminArbiter3, "Yetkisiz.");
        require(!hasVotedCancel[_examinee][msg.sender], "Oy kullanildi.");

        hasVotedCancel[_examinee][msg.sender] = true;
        if (_voteDecision) appeal.yesVotes++; else appeal.noVotes++;
        emit CancelVoteCast(_examinee, msg.sender, _voteDecision);

        if (appeal.yesVotes + appeal.noVotes == 3) {
            appeal.isResolved = true;
            if (appeal.yesVotes >= 2) {
                isCanceled = true;
                isClosed = true;
                emit AssessmentCanceledAlert(_examinee);
            }
        }
    }

    // ------------------------------------------------------------------------
    //  NOTA İTİRAZ (APPEAL A GRADE)
    // ------------------------------------------------------------------------

    // 1. Öğrenci süreci başlatır (1 Yönetici, 1 Öğretmen atanır)
    function requestGradeArbiters() public assessmentNotCanceled {
        require(isExaminee[msg.sender], "Yetkisiz.");
        require(isGraded[msg.sender], "Notunuz girilmemis.");
        require(!hasRequestedGradeAppeal[msg.sender], "Zaten talep var.");

        uint256 tCount = roleContract.teacherCount();
        uint256 aCount = roleContract.adminCount();
        require(tCount >= 1 && aCount >= 1, "Personel yetersiz.");

        uint256 rand = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, msg.sender)));
        
        address tArb = roleContract.teacherById((rand % tCount) + 1);
        address aArb = roleContract.adminById((uint256(keccak256(abi.encodePacked(rand, uint256(1)))) % aCount) + 1);

        gradeAppeals[msg.sender].tArbiter = tArb;
        gradeAppeals[msg.sender].aArbiter = aArb;
        hasRequestedGradeAppeal[msg.sender] = true;

        emit GradeArbitersAssigned(msg.sender, tArb, aArb);
    }

    // 2. Öğrenci dilekçeyi yükler (Hakem Yönetici ve Hakem Öğretmen için şifreli)
    function submitGradeAppeal(string memory _appealHash, string memory _appealCID) public assessmentNotCanceled {
        require(hasRequestedGradeAppeal[msg.sender], "Talep yok.");
        require(!gradeAppeals[msg.sender].isResolved, "Cozuldu.");
        
        gradeAppeals[msg.sender].appealHash = _appealHash;
        gradeAppeals[msg.sender].appealCID = _appealCID;
        
        emit GradeAppealSubmitted(msg.sender, _appealHash, _appealCID);
    }

    // 3. Asıl Öğretmen (Examiner) Cevap Anahtarını SADECE Hakem Öğretmen için yükler
    function provideAnswerKeyForArbiter(address _examinee, string memory _keyHash, string memory _keyCID) public onlyExaminer {
        require(hasRequestedGradeAppeal[_examinee], "Talep yok.");
        
        gradeAppeals[_examinee].answerKeyHash = _keyHash;
        gradeAppeals[_examinee].answerKeyCID = _keyCID;
        gradeAppeals[_examinee].keyProvided = true;

        emit AnswerKeyProvidedForArbiter(_examinee, msg.sender);
    }

    // 4. Hakem Öğretmen raporunu SADECE Hakem Yönetici için yükler
    function submitTeacherGradeReport(address _examinee, string memory _reportHash, string memory _reportCID) public {
        require(gradeAppeals[_examinee].tArbiter == msg.sender, "Hakem ogretmen degilsiniz.");
        require(gradeAppeals[_examinee].keyProvided, "Cevap anahtari bekleniyor.");
        
        gradeAppeals[_examinee].tReportHash = _reportHash;
        gradeAppeals[_examinee].tReportCID = _reportCID;
        gradeAppeals[_examinee].tReported = true;

        emit TeacherGradeReportSubmitted(_examinee, msg.sender);
    }

    // 5. Hakem Yönetici son kararı verir ve Öğrencinin NOTUNU DEĞİŞTİRİR
    function finalizeGradeAppeal(address _examinee, string memory _newGradeHash, string memory _newGradeCID) public {
        require(gradeAppeals[_examinee].aArbiter == msg.sender, "Hakem yonetici degilsiniz.");
        require(gradeAppeals[_examinee].tReported, "Ogretmen raporu bekleniyor.");
        require(!gradeAppeals[_examinee].isResolved, "Zaten cozuldu.");
        
        gradeAppeals[_examinee].isResolved = true;
        
        // Öğrencinin asıl notu (G_j) yenisiyle (G'_j) güncellenir
        studentGrades[_examinee] = Grade({
            gradeHash: _newGradeHash, 
            ipfsCID: _newGradeCID, 
            timestamp: block.timestamp
        });

        emit GradeAppealResolved(_examinee, msg.sender, _newGradeHash, _newGradeCID);
    }
}

contract AssessmentFactory {
    IRoleRegistration public roleContract;
    Assessment[] public deployedAssessments;
    event AssessmentCreated(address indexed assessmentAddress, address indexed examiner);

    modifier onlyTeacher() { require(roleContract.isTeacher(msg.sender), "Yetki yok."); _; }

    constructor(address _roleContractAddress) { roleContract = IRoleRegistration(_roleContractAddress); }

    function createAssessment(string memory _fileHash, string memory _ipfsCID, uint256 _duration, string memory _policy, address[] memory _examinees) public onlyTeacher {
        Assessment newAssessment = new Assessment(address(roleContract), msg.sender, _fileHash, _ipfsCID, _duration, _policy, _examinees);
        deployedAssessments.push(newAssessment);
        emit AssessmentCreated(address(newAssessment), msg.sender);
    }
}