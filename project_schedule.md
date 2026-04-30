# Chapter 7. Project Schedule

**Project:** Event Ticket Scalping Prevention Using Blockchain and AI

## 7.2 Task Network
The task network for the project defines the dependency chain among major activities such as requirement analysis, smart contract design, frontend integration, AI model training, testing, and deployment. 

- **Requirement Analysis** precedes system design.
- **Smart Contract Implementation** and **UI Development** progress in parallel after architecture finalization.
- **AI-based Fraud Detection** is integrated after transaction data pipelines are prepared.
- **Final Testing** is scheduled only after all modules are connected and verified.

```mermaid
graph TD
    %% Define Node Styles
    classDef planning fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    classDef core fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef ai fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef testing fill:#fce4ec,stroke:#c2185b,stroke-width:2px;

    %% Nodes
    RA["Requirement Analysis"]:::planning
    SD["System Design & Architecture"]:::planning
    
    SC["Smart Contract Implementation"]:::core
    UI["UI Development & Frontend"]:::core
    TDP["Transaction Data Pipelines"]:::core
    
    AMT["AI Model Training"]:::ai
    FDI["AI Fraud Detection Integration"]:::ai
    
    FT["Final Testing (All Modules Connected)"]:::testing
    DEP["Deployment"]:::testing

    %% Dependency Links
    RA --> SD
    
    %% Parallel Development
    SD --> SC
    SD --> UI
    
    %% AI and Pipelines
    SC --> TDP
    UI --> TDP
    AMT --> FDI
    TDP --> FDI
    
    %% Final Verification
    SC --> FT
    UI --> FT
    FDI --> FT
    
    FT --> DEP
```

## 7.3 Time-line Charts
The project time-line chart summarizes the execution schedule of each development phase across the semester. These charts help the team track planned milestones, monitor progress, and ensure timely completion of analysis, design, implementation, testing, documentation, and presentation activities.

```mermaid
gantt
    title Semester Execution Schedule - Event Ticket Scalping Prevention
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Planning & Design
    Requirement Analysis         :crit, active, a1, 2026-05-01, 14d
    System Design & Architecture :crit, a2, after a1, 14d

    section Core Implementation
    Smart Contract Implementation :a3, after a2, 28d
    UI Development & Frontend    :a4, after a2, 28d
    Transaction Data Pipelines   :a5, after a3, 14d

    section AI Intelligence
    AI Model Training            :a6, 2026-05-15, 35d
    Fraud Detection Integration  :a7, after a5 a6, 14d

    section Quality & Release
    Final Testing                :crit, a8, after a7, 14d
    Deployment                   :crit, a9, after a8, 7d

    section Continuous Activities
    Documentation                :a10, 2026-05-01, 120d
    Presentation Activities      :a11, after a8, 21d
```
