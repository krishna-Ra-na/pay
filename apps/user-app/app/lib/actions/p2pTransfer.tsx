"use server"
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import prisma from "@repo/db/client";

export async function p2pTransfer(to: string, amount: number) {
    const session = await getServerSession(authOptions);
    const from = session?.user?.id;
    if (!from) {
        return {
            message: "Error while sending"
        }
    }
    const toUser = await prisma.user.findFirst({
        where: {
            number: to
        }
    });

    if (!toUser) {
        return {
            message: "User not found"
        }
    }
    // why are we using transaction  here    
    // prisma.$transaction ---transction is used to solve the problem of -(payment reduced from one account
    // and did not added to another account bec for some reason the server crash or whatever reason...one operation(money reduced) run
    // but the other operation(money added) did not run
    // so we use transaction to make sure that both operation are done or none of them are done

    await prisma.$transaction(async (tx) => {
        // below line is used for locking the row
        // await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(from)} FOR UPDATE`;
        const fromBalance = await tx.balance.findUnique({
            where: { userId: Number(from) },
        });
        if (!fromBalance || fromBalance.amount < amount) {
            throw new Error('Insufficient funds');
        }
        console.log("before sleep")
        await new Promise(r => setTimeout(r, 4000));
        console.log("after sleep")

        await tx.balance.update({
            where: { userId: Number(from) },
            data: { amount: { decrement: amount } },
        });

        await tx.balance.update({
            where: { userId: toUser.id },
            data: { amount: { increment: amount } },
        });
    });
}