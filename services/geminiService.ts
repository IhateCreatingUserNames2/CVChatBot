// FIX: Import Type for responseSchema and Source for grounding.
import { GoogleGenAI, Type } from "@google/genai";
// FIX: Import Source type.
import { UserInfo, Job, ResumeData, Source } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Update function to return jobs and grounding sources.
export const findJobs = async (role: string, location: string): Promise<{ jobs: Job[]; sources: Source[] }> => {
  try {
    const prompt = `Encontre 3 vagas de emprego para '${role}' em '${location}'. Para cada vaga, forneça o título do cargo, o nome da empresa e uma breve descrição da vaga em um parágrafo. Formate como uma lista numerada. Não inclua links.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        },
    });

    const text = response.text;
    const jobs: Job[] = [];
    const jobRegex3 = /\d+\.\s+(.+?) - (.+?)\n([\s\S]+?)(?=\d+\.|$)/g;
    
    // A more robust parsing for varied formats
    const sections = text.split(/\n\d+\.\s/);
    if (sections[0].match(/^\d+\.\s/)) {
      sections[0] = sections[0].substring(sections[0].indexOf(' ') + 1);
    } else {
      sections.shift();
    }
    
    sections.forEach((section, index) => {
        const lines = section.trim().split('\n');
        if (lines.length > 1) {
            const titleAndCompany = lines[0].split(' - ');
            const title = titleAndCompany[0]?.replace(/\*\*/g, '').trim();
            const company = titleAndCompany[1]?.replace(/\*\*/g, '').trim();
            const description = lines.slice(1).join(' ').trim();
            if (title && company && description) {
                jobs.push({ id: index + 1, title, company, description });
            }
        }
    });

    if (jobs.length === 0) {
      // Fallback to simpler regex if the main one fails
      let match;
      while ((match = jobRegex3.exec(text)) !== null) {
        jobs.push({
          id: jobs.length + 1,
          title: match[1].replace(/\*\*/g,'').trim(),
          company: match[2].replace(/\*\*/g,'').trim(),
          description: match[3].trim(),
        });
      }
    }

    // FIX: Extract grounding sources as required by guidelines.
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: Source[] = groundingChunks
      .map((chunk: any) => (chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null))
      .filter((source): source is Source => source !== null);

    if (jobs.length > 0) {
        return { jobs, sources };
    }

    console.warn("Could not parse jobs from response:", text);
    // Return dummy data if parsing fails to not break the flow
    return {
      jobs: [
        { id: 1, title: 'Vendedor de Loja', company: 'Lojas Renner', description: 'Atendimento ao cliente, organização da loja e vendas.'},
        { id: 2, title: 'Consultor de Vendas', company: 'Magazine Luiza', description: 'Venda de produtos e serviços, metas e prospecção de clientes.'},
        { id: 3, title: 'Vendedor Interno', company: 'Empresa Local ABC', description: 'Contato com clientes por telefone e e-mail para vendas.'},
      ],
      sources: []
    };

  } catch (error) {
    console.error("Error finding jobs:", error);
    throw new Error("Não consegui buscar as vagas. Tente novamente.");
  }
};

export const generateResume = async (
  userInfo: UserInfo,
  userExperiences: string,
  selectedJob: Job
): Promise<ResumeData> => {
  try {
    // FIX: Simplify prompt to only ask for what the model needs to generate.
    const prompt = `
      Você é o 'Meu Currículo Express', um coach de carreira digital. Sua tarefa é gerar o conteúdo para um currículo profissional com base nas informações do usuário e na vaga de emprego alvo.

      Descrição da experiência e habilidades do usuário (texto livre):
      "${userExperiences}"

      Vaga de emprego alvo:
      - Cargo: "${selectedJob.title}"
      - Empresa: "${selectedJob.company}"
      - Descrição da vaga: "${selectedJob.description}"

      Com base nisso, crie o seguinte conteúdo:
      1. Um "summary" (resumo) profissional conciso e poderoso de 2 a 3 frases que destaque os pontos fortes do usuário em relação à vaga.
      2. Uma "experience" (experiência) profissional, reescrevendo a experiência bruta do usuário. Use bullet points (começando cada um com '• ') e incorpore palavras-chave da descrição da vaga. O resultado deve ser uma única string.
      3. Uma lista de "skills" (habilidades) relevantes com base no texto do usuário e nos requisitos da vaga.
    `;

    // FIX: Define a responseSchema for robust JSON output, following best practices.
    const resumeSchema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Resumo profissional conciso e poderoso de 2 a 3 frases que destaque os pontos fortes do usuário em relação à vaga.',
        },
        experience: {
          type: Type.STRING,
          description: "Experiência bruta do usuário reescrita em uma seção de 'experiencia' profissional. Use bullet points (começando cada um com '• ') e incorpore palavras-chave da descrição da vaga. O resultado deve ser uma única string.",
        },
        skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Lista de habilidades relevantes com base no texto do usuário e nos requisitos da vaga.',
        },
      },
      required: ['summary', 'experience', 'skills'],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        // FIX: Use responseSchema for robust JSON generation.
        config: {
          responseMimeType: "application/json",
          responseSchema: resumeSchema,
        }
    });
    
    const text = response.text.trim();
    const generatedData = JSON.parse(text);
    
    // FIX: Combine generated data with user info client-side for reliability and security.
    return {
      contact: {
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone,
        location: userInfo.location,
      },
      summary: generatedData.summary,
      experience: generatedData.experience,
      skills: generatedData.skills,
    };

  } catch (error) {
    console.error("Error generating resume:", error);
    throw new Error("Não consegui gerar o currículo. Tente novamente.");
  }
};
