import { Router } from "express";
import { cardsService } from "../services/cards";
import { HttpStatus } from "../type/status";
import { requireAuth } from "../middleware/auth";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

cardsRouter.get("/", (req, res) => {
    (async () => {
        const manaRaw = (req.query.mana as string | undefined) ?? undefined;
        const name = (req.query.name as string | undefined) ?? undefined;
        const tokenRaw = (req.query.token as string | undefined) ?? undefined;
        const typeRaw = (req.query.type as string | undefined) ?? undefined;
        const pageRaw = (req.query.page as string | undefined) ?? undefined;
        const limitRaw = (req.query.limit as string | undefined) ?? undefined;

        const mana =
            manaRaw !== undefined && manaRaw !== "" && !Number.isNaN(Number(manaRaw))
                ? Number(manaRaw)
                : undefined;
        // validation: page가 있는데 limit이 없으면 400
        if (pageRaw !== undefined && (limitRaw === undefined || limitRaw === "")) {
            return res
                .status(HttpStatus.BAD_REQUEST)
                .json({ message: "limit required when page is provided" });
        }

        const page = pageRaw !== undefined ? Number(pageRaw) : undefined;
        const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;

        let token: boolean | undefined = undefined;
        if (typeof tokenRaw === "string" && tokenRaw !== "") {
            const lowered = tokenRaw.toLowerCase();
            if (lowered === "true" || lowered === "1") token = true;
            else if (lowered === "false" || lowered === "0") token = false;
        }

        let type: "instant" | "ritual" | "catastrophe" | "summon" | "item" | undefined = undefined;
        if (typeof typeRaw === "string" && typeRaw !== "") {
            const allowed = new Set(["instant", "ritual", "catastrophe", "summon", "item"]);
            if (allowed.has(typeRaw)) type = typeRaw as any;
            else {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ message: "invalid type" });
            }
        }

        const { items, total, page: p, limit: l } = await cardsService.list({
            mana,
            name,
            token,
            type,
            page,
            limit,
        });
        const normalized = items.map((r) => ({
            id: r.id,
            name_ko: r.name_ko,
            type: r.type,
            mana: r.mana,
            effect_json: r.effect_json ?? null,
            token: r.token,
            description_ko: r.description_ko,
        }));
        res.status(HttpStatus.OK).json({ cards: normalized, total, page: p, limit: l });
    })().catch((e) =>
        res
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: e.message })
    );
});

cardsRouter.get("/:id", (req, res) => {
    (async () => {
        const card = await cardsService.getById(req.params.id);
        if (!card)
            return res
                .status(HttpStatus.NOT_FOUND)
                .json({ message: "not found" });
        return res.json({
            id: card.id,
            name: card.name_ko,
            type: card.type,
            mana: card.mana,
            effects: card.effect_json ?? null,
            token: card.token,
            description_ko: card.description_ko,
        });
    })().catch((e) =>
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message })
    );
});

