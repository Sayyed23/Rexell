import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf():
    pdf_path = r"d:\Rexell\Anti_Sybil_Scenarios.pdf"
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=landscape(letter),
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="CustomTitle",
        fontName="Helvetica-Bold",
        fontSize=18,
        alignment=1, # Center
        spaceAfter=15
    )
    
    cell_style = ParagraphStyle(
        name="Cell",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11
    )

    header_style = ParagraphStyle(
        name="HeaderCell",
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=colors.whitesmoke
    )

    story = []
    story.append(Paragraph("Rexell Anti-Sybil Identity Scenarios (Expanded)", title_style))
    story.append(Spacer(1, 10))

    data = [
        [
            Paragraph("Scenario / User Type", header_style),
            Paragraph("User Action", header_style),
            Paragraph("Requirements (Stake/Vouch)", header_style),
            Paragraph("System Outcome & Explanation", header_style)
        ],
        [
            Paragraph("<b>1. Genuine Fan (New User)</b><br/>No Web3 history, no friends.", cell_style),
            Paragraph("Wants to BUY a 200 INR ticket.", cell_style),
            Paragraph("<b>Zero Stake.</b><br/>Zero Vouches.", cell_style),
            Paragraph("<b>Approved to Buy.</b> Buying threshold is low. User buys frictionlessly.", cell_style)
        ],
        [
            Paragraph("<b>2. Genuine Fan (Web3 Veteran)</b><br/>Old wallet, ENS domain, history.", cell_style),
            Paragraph("Wants to BUY or RESELL.", cell_style),
            Paragraph("<b>Zero Stake.</b><br/>Zero Vouches.", cell_style),
            Paragraph("<b>Approved for Both.</b> On-chain reputation grants Score=70+. No capital locked.", cell_style)
        ],
        [
            Paragraph("<b>3. Genuine Reseller (Vouched)</b><br/>New wallet, got sick, needs to sell.", cell_style),
            Paragraph("Wants to RESELL.", cell_style),
            Paragraph("<b>Zero Stake.</b><br/>1 Vouch from friend.", cell_style),
            Paragraph("<b>Approved to Resell.</b> Friend's collateral is locked. Score hits 70. Friend is safe.", cell_style)
        ],
        [
            Paragraph("<b>4. Genuine Reseller (No Friends)</b><br/>Got sick, no one to vouch.", cell_style),
            Paragraph("Wants to RESELL.", cell_style),
            Paragraph("<b>50 cUSD Stake.</b>", cell_style),
            Paragraph("<b>Approved to Resell.</b> Locks deposit to cross Score=70. Withdraws 50 cUSD later.", cell_style)
        ],
        [
            Paragraph("<b>5. The Sybil Farm</b><br/>100 new wallets hoarding tickets.", cell_style),
            Paragraph("Wants to RESELL 100 tickets.", cell_style),
            Paragraph("<b>5000 cUSD Total Stake</b>.", cell_style),
            Paragraph("<b>Deterred or Slashed.</b> Massive capital required. If caught, 5000 cUSD is slashed.", cell_style)
        ],
        [
            Paragraph("<b>6. The Gullible User</b><br/>Existing user vouches for a stranger/bot.", cell_style),
            Paragraph("Vouches for a bot to help them sell.", cell_style),
            Paragraph("Collateral / Reputation locked.", cell_style),
            Paragraph("<b>Slashed.</b> Bot gets banned. Gullible user loses locked collateral.", cell_style)
        ],
        [
            Paragraph("<b>7. The 'Cluster' Farm</b><br/>Funds 100 wallets from 1 source to bypass checks.", cell_style),
            Paragraph("Wants to RESELL.", cell_style),
            Paragraph("<b>Penalty triggers.</b> Requires 500 cUSD/wallet.", cell_style),
            Paragraph("<b>Deterred.</b> Oracle detects funding cluster. Penalty applied. Cost to attack balloons 10x.", cell_style)
        ],
        [
            Paragraph("<b>8. The 'Vouch Broker'</b><br/>Legit user tries to vouch for 50 people for a fee.", cell_style),
            Paragraph("Attempts to mass-vouch.", cell_style),
            Paragraph("<b>Hard Cap (e.g., max 3 vouches).</b>", cell_style),
            Paragraph("<b>Blocked.</b> Contract limits active vouches per user. Prevents a 'Vouching Black Market'.", cell_style)
        ],
        [
            Paragraph("<b>9. The Patient Scalper</b><br/>Ages a wallet for 6 months without using it.", cell_style),
            Paragraph("Wants to RESELL.", cell_style),
            Paragraph("<b>Partial Stake (e.g., 25 cUSD).</b>", cell_style),
            Paragraph("<b>Deterred.</b> Wallet has 'age' but no 'diversity' (no smart contract interactions). Score only hits 40. Still requires stake.", cell_style)
        ],
        [
            Paragraph("<b>10. The Wash Trader</b><br/>Scalper vouches for their own alt-wallets.", cell_style),
            Paragraph("Creates a fake 'trust web'.", cell_style),
            Paragraph("<b>Requires massive root capital.</b>", cell_style),
            Paragraph("<b>Slashed/Blocked.</b> Requires 1 highly staked root wallet. If the web is caught, the root wallet loses its entire heavy stake.", cell_style)
        ]
    ]

    # Create table
    col_widths = [140, 110, 140, 350]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e3a8a")), # Deep blue header
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))

    story.append(t)
    doc.build(story)
    print("PDF generated successfully at", pdf_path)

if __name__ == "__main__":
    generate_pdf()
