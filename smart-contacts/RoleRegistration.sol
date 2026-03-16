// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract RoleRegistration {
    
    uint256 public adminCount;
    uint256 public teacherCount;

    mapping(address => bool) public isAdministrator;
    mapping(address => bool) public isTeacher;
    mapping(address => bool) public isStudent;

    mapping(uint256 => address) public adminById;
    mapping(uint256 => address) public teacherById;

    mapping(address => string) public encryptionPublicKeys;


    struct AdminProposal {
        address candidate;
        address proposer;
        uint256 yesVotes; 
        uint256 noVotes;  
        bool isProcessed; 
    }

    mapping(uint256 => AdminProposal) public proposals;
    uint256 public proposalCount;
    
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event AdminProposed(uint256 proposalId, address candidate, address proposer);
    event AdminVoted(uint256 proposalId, address voter, uint256 vote);
    event AdminRegistered(address indexed adminAddress, uint256 id);
    event AdminRejected(address indexed candidateAddress);
    event TeacherRegistered(address indexed teacherAddress, uint256 id);
    event StudentRegistered(address indexed studentAddress);
    event PublicKeyRegistered(address indexed user, string publicKey);

    modifier onlyAdmin() {
        require(isAdministrator[msg.sender], "Sadece yoneticiler (Administrators) islem yapabilir!");
        _;
    }

    constructor(address[] memory initialAdmins) {
        require(initialAdmins.length > 0, "En az bir baslangic yoneticisi olmali!");
        
        for(uint i = 0; i < initialAdmins.length; i++) {
            address admin = initialAdmins[i];
            require(!isAdministrator[admin], "Ayni yonetici birden fazla eklenemez.");
            
            isAdministrator[admin] = true;
            adminCount++;
            adminById[adminCount] = admin;
            
            emit AdminRegistered(admin, adminCount);
        }
    }

    function proposeNewAdmin(address _candidate) public onlyAdmin {
        require(!isAdministrator[_candidate], "Bu adres zaten bir yonetici.");
        
        proposalCount++;
        AdminProposal storage p = proposals[proposalCount];
        p.candidate = _candidate;
        p.proposer = msg.sender;
        
        emit AdminProposed(proposalCount, _candidate, msg.sender);
    }

    function voteAdmin(uint256 _proposalId, uint256 _vote) public onlyAdmin {
        AdminProposal storage p = proposals[_proposalId];
        
        require(!p.isProcessed, "Bu oylama zaten sonuclandirilmis.");
        require(!hasVoted[_proposalId][msg.sender], "Bu oylama icin zaten oy kullandiniz.");
        require(_vote == 0 || _vote == 1, "Oy sadece 1 (Kabul) veya 0 (Ret) olabilir.");

        hasVoted[_proposalId][msg.sender] = true;

        if (_vote == 1) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }
        
        emit AdminVoted(_proposalId, msg.sender, _vote);
    }

    function executeAdminRegistration(uint256 _proposalId) public onlyAdmin {
        AdminProposal storage p = proposals[_proposalId];
        
        require(!p.isProcessed, "Bu teklif zaten islenmis.");
        require(msg.sender == p.proposer, "Sadece teklifi baslatan yonetici sonucu isleyebilir.");

        uint256 totalVotes = p.yesVotes + p.noVotes;
        require(totalVotes * 2 > adminCount, "Oylamaya yeterli katilim olmadi (Mevcut yoneticilerin yarisindan fazlasi oy kullanmali).");

        p.isProcessed = true;

        if (p.noVotes > p.yesVotes) {
            emit AdminRejected(p.candidate);
        } else {
            require(!isAdministrator[p.candidate], "Aday oylama sirasinda baska bir sekilde admin olmus.");
            isAdministrator[p.candidate] = true;
            adminCount++;
            adminById[adminCount] = p.candidate;
            
            emit AdminRegistered(p.candidate, adminCount);
        }
    }

    function registerTeacher(address _teacher) public onlyAdmin {
        require(!isTeacher[_teacher], "Bu adres zaten ogretmen.");
        require(!isAdministrator[_teacher] && !isStudent[_teacher], "Baska bir rolde kayitli.");
        
        isTeacher[_teacher] = true;
        teacherCount++;
        teacherById[teacherCount] = _teacher;
        
        emit TeacherRegistered(_teacher, teacherCount);
    }

    function registerEncryptionKey(string memory _pubKey) public {
        require(isAdministrator[msg.sender] || isTeacher[msg.sender] || isStudent[msg.sender], "Sisteme kayitli bir rolunuz yok.");
        encryptionPublicKeys[msg.sender] = _pubKey;
        emit PublicKeyRegistered(msg.sender, _pubKey);
    }

    function registerStudent(address _student) public onlyAdmin {
        require(!isStudent[_student], "Bu adres zaten ogrenci.");
        require(!isAdministrator[_student] && !isTeacher[_student], "Baska bir rolde kayitli.");
        
        isStudent[_student] = true;
        
        emit StudentRegistered(_student);
    }
}