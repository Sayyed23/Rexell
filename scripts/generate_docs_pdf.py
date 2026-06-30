import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def add_footer(canvas, doc):   
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor("#64748b"))  # Slate-500 00
    
    # Draw a thin footer line
    canvas.setStrokeColor(colors.HexColor("#e2e8f0"))  # Slate-200
    canvas.setLineWidth(0.5)
    canvas.line(54, 45, doc.pagesize[0] - 54, 45)
    
    # Draw footer text
    canvas.drawString(54, 30, "Rexell Event Ticketing & Anti-Scalping Platform — Technical Manual")
    canvas.drawRightString(doc.pagesize[0] - 54, 30, f"Page {doc.page}")
    canvas.restoreState()

def build_story_from_md(content):
    styles = getSampleStyleSheet()
    
    # Custom premium styles matching our aesthetics
    title_style = ParagraphStyle(
        name="CustomTitle",
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),  # Dark slate
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        name="CustomH2",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1e3a8a"),  # Deep blue
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h3_style = ParagraphStyle(
        name="CustomH3",
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor("#334155"),  # Medium dark slate
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        name="CustomBody",
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4
    )
    
    bullet_style = ParagraphStyle(
        name="CustomBullet",
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        name="CustomCode",
        fontName="Courier",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
        leftIndent=10,
        spaceAfter=4
    )

    alert_style = ParagraphStyle(
        name="CustomAlert",
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#b45309"),  # Amber/brown
        leftIndent=15,
        spaceAfter=5
    )

    story = []
    lines = content.split("\n")
    
    in_code_block = False
    code_block_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Code block handling
        if line.strip().startswith("```"):
            if in_code_block:
                # End of code block
                in_code_block = False
                code_text = "<br/>".join(code_block_lines)
                
                # Render as a table with a background color for nice formatting
                t = Table([[Paragraph(code_text, code_style)]], colWidths=[500])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
                    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                    ('PADDING', (0,0), (-1,-1), 6),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
                code_block_lines = []
            else:
                in_code_block = True
            i += 1
            continue
            
        if in_code_block:
            # Clean up XML tags to avoid ReportLab syntax issues
            safe_line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            # Preserve indentation with non-breaking spaces
            safe_line = safe_line.replace(" ", "&nbsp;")
            code_block_lines.append(safe_line)
            i += 1
            continue

        # Skip horizontal rules
        if line.strip() in ("---", "***"):
            story.append(Spacer(1, 4))
            line_table = Table([[""]], colWidths=[500])
            line_table.setStyle(TableStyle([
                ('LINEABOVE', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(line_table)
            story.append(Spacer(1, 4))
            i += 1
            continue
            
        stripped = line.strip()
        if not stripped:
            i += 1
            continue

        # Replace markdown formatting with HTML tags
        # Bold: **text** -> <b>text</b>
        stripped = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", stripped)
        # Italic: *text* -> <i>text</i>
        stripped = re.sub(r"\*(.*?)\*", r"<i>\1</i>", stripped)
        # Inline code: `code` -> <font name="Courier">code</font>
        stripped = re.sub(r"`(.*?)`", r'<font face="Courier">\1</font>', stripped)
        
        # Headings
        if stripped.startswith("# "):
            title_text = stripped[2:]
            story.append(Spacer(1, 10))
            story.append(Paragraph(title_text, title_style))
            story.append(Spacer(1, 10))
        elif stripped.startswith("## "):
            h2_text = stripped[3:]
            story.append(Spacer(1, 8))
            story.append(Paragraph(h2_text, h2_style))
            story.append(Spacer(1, 4))
        elif stripped.startswith("### "):
            h3_text = stripped[4:]
            story.append(Spacer(1, 6))
            story.append(Paragraph(h3_text, h3_style))
            story.append(Spacer(1, 3))
        # Blockquotes/Alerts
        elif stripped.startswith(">"):
            alert_text = stripped[1:].strip()
            # If it's a headers line like > [!IMPORTANT]
            if alert_text.startswith("[!"):
                header_match = re.match(r"\[!(.*?)\]", alert_text)
                if header_match:
                    tag = header_match.group(1)
                    alert_text = f"<b>{tag}:</b> "
                    # check if there's text after the block
                    remaining_line = re.sub(r"\[!(.*?)\]", "", alert_text).strip()
                    while i + 1 < len(lines) and lines[i+1].strip().startswith(">"):
                        i += 1
                        next_part = lines[i].strip()[1:].strip()
                        alert_text += " " + next_part
                    alert_text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", alert_text)
                    alert_text = re.sub(r"`(.*?)`", r'<font face="Courier">\1</font>', alert_text)
            
            # Format blockquote box
            t = Table([[Paragraph(alert_text, alert_style)]], colWidths=[480])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fffbeb")), # Light amber
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#fef3c7")),
                ('LINELEFT', (0,0), (-1,-1), 3.0, colors.HexColor("#d97706")), # Thick amber left border
                ('PADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(t)
            story.append(Spacer(1, 6))
        # Bullet list items
        elif stripped.startswith("* ") or stripped.startswith("- "):
            bullet_text = "&bull;&nbsp;&nbsp;" + stripped[2:]
            story.append(Paragraph(bullet_text, bullet_style))
        # Ordered list items
        elif re.match(r"^\d+\.\s+", stripped):
            match = re.match(r"^(\d+\.)\s+(.*)", stripped)
            num_prefix = match.group(1)
            item_text = match.group(2)
            bullet_text = f"{num_prefix}&nbsp;&nbsp;{item_text}"
            story.append(Paragraph(bullet_text, bullet_style))
        # Ordinary Paragraph
        else:
            story.append(Paragraph(stripped, body_style))
            story.append(Spacer(1, 2))
            
        i += 1
    return story

def convert_md_to_pdf(md_path, pdf_path):
    print(f"Reading markdown from {md_path}...")
    if not os.path.exists(md_path):
        raise FileNotFoundError(f"Markdown file not found: {md_path}")
        
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=54,  # 0.75 inch
        leftMargin=54,
        topMargin=54,
        bottomMargin=64  # Extra room for the footer
    )

    story = build_story_from_md(content)

    print(f"Building PDF at {pdf_path}...")
    try:
        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        print("PDF build completed successfully!")
    except PermissionError:
        fallback_path = pdf_path.replace(".pdf", "_v2.pdf")
        print(f"Permission denied on {pdf_path} (likely locked in viewer). Trying fallback: {fallback_path}")
        fallback_doc = SimpleDocTemplate(
            fallback_path,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=64
        )
        # Re-build story because ReportLab consumed it in the first attempt
        fallback_story = build_story_from_md(content)
        fallback_doc.build(fallback_story, onFirstPage=add_footer, onLaterPages=add_footer)
        print(f"PDF build completed successfully at fallback path: {fallback_path}")

if __name__ == "__main__":
    md_file = r"d:\Rexell\Rexell_Complete_System_Documentation.md"
    pdf_file = r"d:\Rexell\Rexell_Complete_System_Documentation.pdf"
    convert_md_to_pdf(md_file, pdf_file)
