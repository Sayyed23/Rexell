# Chapter 7. Project Schedule

**Project:** Event Ticket Scalping Prevention Using Blockchain and AI

---

## 7.2 Task Network

The task network defines the dependency chain among major activities. By establishing a clear flow from analysis to deployment, the team can ensure modules are integrated in the correct sequence.

```mermaid
flowchart LR
    %% Clean, modern styling
    classDef plan fill:#E3F2FD,stroke:#1E88E5,stroke-width:2px,color:#0D47A1,rx:5px,ry:5px
    classDef dev fill:#FFF3E0,stroke:#FB8C00,stroke-width:2px,color:#E65100,rx:5px,ry:5px
    classDef ai fill:#F3E5F5,stroke:#8E24AA,stroke-width:2px,color:#4A148C,rx:5px,ry:5px
    classDef finish fill:#E8F5E9,stroke:#43A047,stroke-width:2px,color:#1B5E20,rx:5px,ry:5px

    %% Nodes
    A([Requirement Analysis]):::plan --> B([System Design & Architecture]):::plan
    
    %% Parallel Dev
    B --> C([Smart Contracts]):::dev
    B --> D([Frontend UI]):::dev
    
    C --> E([Transaction Pipelines]):::dev
    D --> E
    
    %% AI Integration
    F([AI Model Training]):::ai --> G([AI Fraud Detection Integration]):::ai
    E --> G
    
    %% Testing & Deploy
    C --> H([Final Testing]):::finish
    D --> H
    G --> H
    
    H --> I([Deployment]):::finish
```

### Dependency Rules:
1. **Analysis First:** Requirement analysis precedes system design.
2. **Parallel Development:** Smart contracts and UI develop simultaneously after architecture is finalized.
3. **Data Dependency:** AI fraud detection is only integrated *after* transaction data pipelines are ready.
4. **All Systems Go:** Final testing begins only when all modules (Contracts, UI, AI) are connected.

---

## 7.3 Timeline Charts

The execution schedule helps the team track milestones and ensure timely completion across the project lifecycle (June 2025 to June 2026), reflecting all core workspace components including Blockchain, Frontend, AI, and Bot Detection APIs.

```mermaid
gantt
    title Project Execution Timeline (June 2025 - June 2026)
    dateFormat  YYYY-MM-DD
    axisFormat  %Y-%b
    
    section 1. Planning & Design
    Requirement Analysis       :crit, a1, 2025-06-01, 30d
    System Design & Arch       :a2, after a1, 30d

    section 2. Core Blockchain
    Smart Contracts (Solidity) :a3, 2025-08-01, 60d
    Transaction Data Pipelines :a4, after a3, 45d

    section 3. Frontend UI
    UI Design & Prototyping    :a5, 2025-09-01, 45d
    Web3 Frontend Integration  :a6, after a5, 60d

    section 4. AI & Bot Detection
    Dataset Prep & Engineering :a7, 2025-11-01, 45d
    AI Model Training          :a8, after a7, 60d
    Bot Detection API Dev      :a9, after a8, 45d
    
    section 5. Testing & Deploy
    Integration Testing        :crit, a10, 2026-04-01, 30d
    Security Audit & UAT       :a11, after a10, 20d
    Final Deployment           :crit, a12, 2026-05-21, 15d

    section Ongoing
    Documentation              :a13, 2025-06-01, 384d
    Project Presentation       :a14, 2026-06-05, 15d
```
