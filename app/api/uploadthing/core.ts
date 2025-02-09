import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { pinecone } from "@/lib/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";


const f = createUploadthing()

const middleware = async () => {
  const { getUser } = getKindeServerSession()
  const user = await getUser()

  if (!user || !user.id) throw new Error('Unauthorized')

  const subscriptionPlan = await getUserSubscriptionPlan()

  return { subscriptionPlan, userId: user.id }
}

const onUploadComplete = async ({
  metadata,
  file,
}: {
  metadata: Awaited<ReturnType<typeof middleware>>
  file: {
    key: string
    name: string
    url: string
  }
}) => {
  const isFileExist = await db.file.findFirst({
    where: {
      key: file.key,
    },
  })

  if (isFileExist) return

  const createdFile = await db.file.create({
    data: {
      key: file.key,
      name: file.name,
      userId: metadata.userId,
     url: `https://utfs.io/f/${file.key}`,
      uploadStatus: 'PROCESSING',
    },
  })

  try {
    const response = await fetch(
      `https://utfs.io/f/${file.key}`
    )

    const blob = await response.blob()

    const loader = new PDFLoader(blob)

    const pageLevelDocs = await loader.load()

    const pagesAmt = pageLevelDocs.length

    const { subscriptionPlan } = metadata
    const { isSubscribed } = subscriptionPlan

    const isProExceeded =
      pagesAmt >
      PLANS.find((plan) => plan.name === 'Pro')!.pagesPerPdf
    const isFreeExceeded =
      pagesAmt >
      PLANS.find((plan) => plan.name === 'Free')!
        .pagesPerPdf

    if (
      (isSubscribed && isProExceeded) ||
      (!isSubscribed && isFreeExceeded)
    ) {
      await db.file.update({
        data: {
          uploadStatus: 'FAILED',
        },
        where: {
          id: createdFile.id,
        },
      })
    }

    // vectorize and index entire document
    const pineconeIndex = pinecone.Index('smartdoc')

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    await PineconeStore.fromDocuments(
      pageLevelDocs,
      embeddings,
      {
        pineconeIndex,
        namespace: createdFile.id,
      }
    )

    await db.file.update({
      data: {
        uploadStatus: 'SUCCESS',
      },
      where: {
        id: createdFile.id,
      },
    })
  } catch (err) {
    await db.file.update({
      data: {
        uploadStatus: 'FAILED',
      },
      where: {
        id: createdFile.id,
      },
    })
  }
}

export const ourFileRouter = {
  freePlanUploader: f({ pdf: { maxFileSize: '4MB' } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ pdf: { maxFileSize: '16MB' } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter





// const f = createUploadthing();
 
 
// export const ourFileRouter = {
//   pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
//     .middleware(async ({ req }) => {
//         const {getUser}= getKindeServerSession()
//         const user = await getUser()
        
//   if (!user || !user.id) throw new Error('Unauthorized')

//     const subscriptionPlan = await getUserSubscriptionPlan()
  
//     return { subscriptionPlan, userId: user.id }
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//         const createdFile=await db.file.create({
//             data:{
//                 key:file.key,
//                 name:file.name,
//                 userId:metadata.userId,
//                 url: `https://utfs.io/f/${file.key}`,
//                 uploadStatus: 'PROCESSING',
//             },
//         })
//         try {
//           const response = await fetch(
//             `https://utfs.io/f/${file.key}`
//           )
      
//           const blob = await response.blob()
      
//           const loader = new PDFLoader(blob)
          
//           const pageLevelDocs = await loader.load()

//           const pagesAmt = pageLevelDocs.length

//           const { subscriptionPlan } = metadata
//     const { isSubscribed } = subscriptionPlan

//     const isProExceeded =
//       pagesAmt >
//       PLANS.find((plan) => plan.name === 'Pro')!.pagesPerPdf
//     const isFreeExceeded =
//       pagesAmt >
//       PLANS.find((plan) => plan.name === 'Free')!
//         .pagesPerPdf

//     if (
//       (isSubscribed && isProExceeded) ||
//       (!isSubscribed && isFreeExceeded)
//     ) {
//       await db.file.update({
//         data: {
//           uploadStatus: 'FAILED',
//         },
//         where: {
//           id: createdFile.id,
//         },
//       })
//     }

//            // vectorize and index entire document
          
//           const pineconeIndex = pinecone.Index('smartdoc')


//           const embeddings = new OpenAIEmbeddings({
//             openAIApiKey: process.env.OPENAI_API_KEY,
//           })

//           await PineconeStore.fromDocuments(
//             pageLevelDocs,
//             embeddings,
//             {
//               pineconeIndex,
//               namespace: createdFile.id,
//             }
//           )
//           await db.file.update({
//             data: {
//               uploadStatus: 'SUCCESS',
//             },
//             where: {
//               id: createdFile.id,
//             },
//           })
//         }
//         catch(err)
//         {
//           console.log(err)
//           await db.file.update({
//             data: {
//               uploadStatus: 'FAILED',
//             },
//             where: {
//               id: createdFile.id,
//             },
//           })
//         }
        
//     }),
// } satisfies FileRouter;
 
// export type OurFileRouter = typeof ourFileRouter;