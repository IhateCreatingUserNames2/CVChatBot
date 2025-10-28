
import { ResumeData } from '../types';

declare global {
  interface Window {
    jspdf: any;
  }
}

export const createPdf = (resumeData: ResumeData): void => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(resumeData.contact.name, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Contact Info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const contactInfo = `${resumeData.contact.phone}  |  ${resumeData.contact.email}  |  ${resumeData.contact.location}`;
  doc.text(contactInfo, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Line separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Summary section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Resumo Profissional", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const summaryLines = doc.splitTextToSize(resumeData.summary, pageWidth - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 10;

  // Experience section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Experiência Profissional", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const experienceLines = doc.splitTextToSize(resumeData.experience, pageWidth - margin * 2);
  doc.text(experienceLines, margin, y);
  y += experienceLines.length * 5 + 10;

  // Skills section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Habilidades", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  
  const skillsText = resumeData.skills.map(skill => `• ${skill}`).join('      ');
  const skillsLines = doc.splitTextToSize(skillsText, pageWidth - margin * 2);
  doc.text(skillsLines, margin, y);

  // Save the PDF
  doc.save(`${resumeData.contact.name.replace(/\s+/g, '_')}_CV.pdf`);
};
